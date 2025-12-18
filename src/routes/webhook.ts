import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { DbClient } from '../db/client';
import { 
  lineChannels, 
  customers, 
  registrationCodes, 
  inboundMessages,
  users
} from '../db/schema';
import { verifyLineSignature, generateId } from '../lib/utils';
import { LineMessagingClient } from '../lib/line';

export function createWebhookRoutes(db: DbClient) {
  const app = new Hono();

  /**
   * LINE Webhook受信エンドポイント
   */
  app.post('/line', async (c) => {
    try {
      const signature = c.req.header('x-line-signature');
      if (!signature) {
        return c.json({ error: 'Missing signature' }, 401);
      }

      const bodyText = await c.req.text();
      const body = JSON.parse(bodyText);

      // destination（botUserId）でLINEチャンネルを特定
      const destination = body.destination;
      if (!destination) {
        return c.json({ error: 'Missing destination' }, 400);
      }

      const [channel] = await db
        .select()
        .from(lineChannels)
        .where(eq(lineChannels.botUserId, destination))
        .limit(1);

      if (!channel) {
        console.error('Channel not found for destination:', destination);
        return c.json({ error: 'Channel not found' }, 404);
      }

      // 署名検証
      const isValid = await verifyLineSignature(bodyText, signature, channel.channelSecret);
      if (!isValid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }

      // イベント処理
      const events = body.events || [];
      for (const event of events) {
        await handleLineEvent(db, channel, event);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}

/**
 * LINEイベント処理
 */
async function handleLineEvent(
  db: DbClient,
  channel: any,
  event: any
): Promise<void> {
  const { type, source, message, replyToken } = event;
  const lineUserId = source?.userId;

  if (!lineUserId) {
    console.log('No userId in event source');
    return;
  }

  switch (type) {
    case 'message':
      await handleMessageEvent(db, channel, lineUserId, message, replyToken);
      break;

    case 'follow':
      await handleFollowEvent(db, channel, lineUserId);
      break;

    case 'unfollow':
      await handleUnfollowEvent(db, channel.storeId, lineUserId);
      break;

    default:
      console.log('Unhandled event type:', type);
  }
}

/**
 * メッセージ受信処理
 */
async function handleMessageEvent(
  db: DbClient,
  channel: any,
  lineUserId: string,
  message: any,
  replyToken: string
): Promise<void> {
  const messageText = message.text?.trim();

  if (!messageText) {
    return;
  }

  // 顧客を検索
  let [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, channel.storeId),
        eq(customers.lineUserId, lineUserId)
      )
    )
    .limit(1);

  // 登録コードチェック
  if (!customer) {
    const codeMatch = messageText.match(/^([A-Z0-9]{4,6})$/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      await handleRegistrationCode(db, channel, lineUserId, code, replyToken);
      return;
    }
  }

  // 受信メッセージ保存
  await db.insert(inboundMessages).values({
    id: generateId('msg'),
    storeId: channel.storeId,
    customerId: customer?.id || null,
    lineUserId,
    messageType: message.type,
    body: messageText,
    receivedAt: new Date(),
  });

  console.log(`Received message from ${lineUserId}: ${messageText}`);
}

/**
 * 登録コード処理
 */
async function handleRegistrationCode(
  db: DbClient,
  channel: any,
  lineUserId: string,
  code: string,
  replyToken: string
): Promise<void> {
  // 有効な登録コードを検索
  const [regCode] = await db
    .select()
    .from(registrationCodes)
    .where(
      and(
        eq(registrationCodes.storeId, channel.storeId),
        eq(registrationCodes.code, code)
      )
    )
    .limit(1);

  if (!regCode) {
    console.log('Invalid registration code:', code);
    return;
  }

  // 有効期限チェック
  if (new Date() > new Date(regCode.expiresAt)) {
    console.log('Expired registration code:', code);
    return;
  }

  // 既に使用済みチェック
  if (regCode.usedAt) {
    console.log('Already used registration code:', code);
    return;
  }

  // LINEプロフィール取得
  const lineClient = new LineMessagingClient(channel.channelAccessToken);
  const profile = await lineClient.getProfile(lineUserId);

  // 既存顧客チェック
  let [existingCustomer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, channel.storeId),
        eq(customers.lineUserId, lineUserId)
      )
    )
    .limit(1);

  if (existingCustomer) {
    // 既存顧客の場合は担当キャストを更新
    await db
      .update(customers)
      .set({
        assignedCastId: regCode.castId,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existingCustomer.id));

    await db
      .update(registrationCodes)
      .set({
        usedAt: new Date(),
        usedByCustomerId: existingCustomer.id,
      })
      .where(eq(registrationCodes.id, regCode.id));

    console.log('Updated existing customer:', existingCustomer.id);
  } else {
    // 新規顧客作成
    const customerId = generateId('cust');

    await db.insert(customers).values({
      id: customerId,
      storeId: channel.storeId,
      lineUserId,
      lineDisplayName: profile?.displayName || null,
      assignedCastId: regCode.castId,
      messagingStatus: 'active',
    });

    await db
      .update(registrationCodes)
      .set({
        usedAt: new Date(),
        usedByCustomerId: customerId,
      })
      .where(eq(registrationCodes.id, regCode.id));

    console.log('Created new customer:', customerId);
  }

  // キャスト名を取得
  const [cast] = await db
    .select()
    .from(users)
    .where(eq(users.id, regCode.castId))
    .limit(1);

  // 登録完了メッセージを返信
  const replyMessage = `ご登録ありがとうございます！担当: ${cast?.displayName || 'スタッフ'}`;
  await lineClient.replyMessage(replyToken, replyMessage);
}

/**
 * フォロー処理
 */
async function handleFollowEvent(
  db: DbClient,
  channel: any,
  lineUserId: string
): Promise<void> {
  // 既存顧客がいれば、messagingStatusを更新
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, channel.storeId),
        eq(customers.lineUserId, lineUserId)
      )
    )
    .limit(1);

  if (customer) {
    await db
      .update(customers)
      .set({
        messagingStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));

    console.log('Re-followed customer:', customer.id);
  }
}

/**
 * アンフォロー処理
 */
async function handleUnfollowEvent(
  db: DbClient,
  storeId: string,
  lineUserId: string
): Promise<void> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, storeId),
        eq(customers.lineUserId, lineUserId)
      )
    )
    .limit(1);

  if (customer) {
    await db
      .update(customers)
      .set({
        messagingStatus: 'unfollowed',
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));

    console.log('Unfollowed customer:', customer.id);
  }
}
