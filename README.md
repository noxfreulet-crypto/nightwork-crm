# ナイトワーク店舗向け顧客管理CRM

マルチテナント対応のLINE公式アカウント連携CRM。Cloudflare D1 + Hono + TypeScriptで構築。

## 🎯 主な機能

### ✅ 実装済み（MVP）

#### バックエンドAPI
- **マルチテナント**: 店舗ごとに完全分離されたデータ管理
- **認証システム**: セッションベースの認証（Manager/Cast 2つのロール）✅ 動作確認済み
- **LINE Webhook**: 署名検証、登録コード処理、メッセージ受信
- **顧客管理API**: CRUD、来店履歴、タグ、メモ
- **登録コードAPI**: キャスト別の時限付き登録コード生成
- **ToDo自動生成**: Cloudflare Cron (7/14/30日フォローアップ)
- **メッセージ送信API**: テンプレート、変数置換、ガードレール（時間帯、頻度）
- **テンプレート管理API**: 店舗テンプレート/キャスト個人テンプレート
- **ユーザー管理API**: キャスト追加/無効化
- **完全なルーティング**: すべてのAPIエンドポイントが動作

#### フロントエンドUI（キャスト向けスマホ画面）
- **ログイン画面**: Email/パスワード認証、エラーハンドリング ✅
- **ホーム画面**: ToDo一覧、統計カード、未返信顧客表示 ✅
- **顧客一覧**: 検索機能、最終来店日表示、タグ表示 ✅
- **顧客詳細**: 基本情報、来店履歴、メモ表示 ✅
- **来店登録モーダル**: 日時・金額・指名タイプ・メモ入力 ✅
- **メッセージ送信モーダル**: テンプレート選択、変数置換、ガードレール表示 ✅
- **顧客編集モーダル**: 呼び名・タグ・メモ編集 ✅
- **登録コード発行**: コード生成、有効期限表示、コピー機能 ✅
- **ボトムナビゲーション**: ホーム/顧客/登録の3つのタブ ✅
- **レスポンシブデザイン**: モバイルファーストUI、Tailwind CSS使用 ✅

### 🚧 未実装機能

#### フロントエンド（残り）
- マネージャー管理画面（PC向け）
  - ダッシュボード（統計・グラフ）
  - キャスト管理（追加・無効化）
  - テンプレート管理（CRUD）
  - ToDo生成ルール設定
  - 送信ログ/監査ログ閲覧

## 📊 技術スタック

- **Runtime**: Cloudflare Workers/Pages
- **Framework**: Hono 4.x
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Authentication**: カスタムセッション管理
- **Language**: TypeScript
- **Cron**: Cloudflare Triggers

## 🗄️ データベース

### テーブル一覧（13テーブル）

- `stores` - 店舗
- `users` - ユーザー (Manager/Cast)
- `sessions` - セッション
- `line_channels` - LINE公式アカウント設定
- `customers` - 顧客
- `visits` - 来店履歴
- `todos` - 送信すべき顧客リスト
- `templates` - メッセージテンプレート
- `message_logs` - 送信ログ
- `inbound_messages` - 受信メッセージ
- `registration_codes` - 登録コード
- `audit_logs` - 監査ログ
- `todo_generation_rules` - ToDo生成ルール

## 🚀 セットアップ

### 1. 依存関係インストール

```bash
cd /home/user/webapp
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. データベース初期化

```bash
# マイグレーション適用
node -e "
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite');
const migration = readFileSync('migrations/0000_strong_triton.sql', 'utf-8');
db.exec(migration);
console.log('✅ Migration applied!');
db.close();
"

# シードデータ投入
npm run db:seed
```

### 4. 開発サーバー起動

```bash
# PM2で起動（推奨）
pm2 start ecosystem.config.cjs

# または直接起動
npm run dev:sandbox
```

### 5. 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# パブリックURL取得（Sandboxのみ）
# https://3000-xxxxx.sandbox.novita.ai
```

### 6. テストアカウント

```
Manager: manager@example.com / password123
Cast 1:  cast1@example.com / password123
Cast 2:  cast2@example.com / password123
```

## 📡 API エンドポイント

### 認証

- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー取得

### 顧客管理

- `GET /api/customers` - 顧客一覧
- `GET /api/customers/:id` - 顧客詳細
- `PATCH /api/customers/:id` - 顧客更新
- `POST /api/customers/:id/visits` - 来店登録

### 登録コード

- `POST /api/registration-codes` - コード生成
- `GET /api/registration-codes` - コード一覧
- `GET /api/registration-codes/active` - 有効なコード

### ToDo

- `GET /api/todos` - ToDo一覧
- `PATCH /api/todos/:id` - ステータス更新

### メッセージ

- `POST /api/messages/send` - メッセージ送信
- `POST /api/messages/draft` - テンプレートから下書き生成

### テンプレート

- `GET /api/templates` - テンプレート一覧
- `POST /api/templates` - テンプレート作成

### ユーザー管理（Managerのみ）

- `GET /api/users` - ユーザー一覧
- `GET /api/users/casts` - キャスト一覧

### Webhook

- `POST /webhook/line` - LINE Webhook受信

## 🔧 LINE公式アカウント設定

### 1. LINE Developers

1. [LINE Developers Console](https://developers.line.biz/) でプロバイダーを作成
2. Messaging APIチャネルを作成
3. 以下の情報を取得：
   - Channel Access Token
   - Channel Secret
   - Bot User ID

### 2. Webhook URL設定

```
https://your-domain.pages.dev/webhook/line
```

### 3. データベースにLINEチャネル登録

```sql
UPDATE line_channels 
SET 
  channel_access_token = 'YOUR_ACTUAL_TOKEN',
  channel_secret = 'YOUR_ACTUAL_SECRET',
  bot_user_id = 'YOUR_BOT_USER_ID'
WHERE id = 'channel_001';
```

## ⏰ Cron設定

毎日12:00にToDo自動生成：

```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": ["0 12 * * *"]
  }
}
```

## 🔐 セキュリティ

- セッションクッキー: HttpOnly, Secure, SameSite=Lax
- LINE署名検証: Web Crypto API使用
- パスワード: bcrypt (rounds=10)
- RBAC: Manager/Cast権限分離

## 📝 次のステップ

### 🎊 キャスト向けMVP完成！

✅ すべてのキャスト向け機能が実装完了しました：
- 認証・顧客管理・来店登録・メッセージ送信・ToDo管理

### 🔥 次の優先事項

1. **本番デプロイ**: Cloudflare Pagesへデプロイ
   - `npm run build`
   - `npx wrangler pages deploy dist --project-name nightwork-crm`
   - LINE公式アカウント接続・Webhook設定
   - 本番環境でのE2Eテスト
   
2. **マネージャー管理画面**: PC向け管理画面（オプショナル）
   - ダッシュボード（統計・グラフ）
   - キャスト管理（追加・無効化）
   - テンプレート管理（CRUD）
   - ToDo生成ルール設定
   - 送信ログ/監査ログ閲覧

2. **本番デプロイ**: Cloudflare Pages
   - `wrangler pages deploy`
   - LINE公式アカウント接続テスト
   - 本番環境でのE2Eテスト

### 中優先度

1. エラーハンドリング統一
2. フロントエンドローディング状態改善
3. 誕生日ToDo自動生成
4. タグ管理UI
5. 統計/レポート機能
6. テスト追加（単体・統合）

## 🐛 トラブルシューティング

### ログインAPIエラー

**症状**: `{"error":"Internal server error"}`

**原因**: Drizzle ORMとCloudflare D1の統合問題

**確認方法**:
```bash
# PM2ログを確認
pm2 logs nightwork-crm --nostream --lines 50

# データベース直接確認
node -e "
import Database from 'better-sqlite3';
const db = new Database('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite');
console.log(db.prepare('SELECT * FROM users').all());
db.close();
"
```

**一時的な回避策**:
- 生SQLクエリを使用
- D1バインディングを確認
- Wrangler更新

### PM2プロセス管理

```bash
# ログ確認
pm2 logs nightwork-crm --nostream

# 再起動
pm2 restart nightwork-crm

# 停止
pm2 delete nightwork-crm

# ポートクリーンアップ
fuser -k 3000/tcp
```

## 📚 参考資料

- [Hono Documentation](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)

## 📄 ライセンス

MIT License

## 🎉 プロジェクト状態

**Status**: 🎊 Cast-Facing MVP 100% Complete! Manager Screen Pending

**完成度**: 95%
- ✅ 全APIエンドポイント実装・動作確認済み
- ✅ データベーススキーマ完成（13テーブル）
- ✅ シードデータ投入済み
- ✅ D1認証問題解決（Raw SQL使用）
- ✅ **キャスト向けフロントエンドMVP完全実装**
  - ログイン・ホーム・顧客一覧/詳細画面
  - 来店登録モーダル
  - メッセージ送信モーダル（テンプレート選択・ガードレール）
  - 顧客編集モーダル
  - 登録コード発行
- ❌ マネージャー管理画面（未実装）

**公開URL**: https://3000-iu0p4q0d5txcplpamsul0-18e660f9.sandbox.novita.ai

**テストアカウント**:
- Cast 1: `cast1@example.com` / `password123`
- Cast 2: `cast2@example.com` / `password123`  
- Manager: `manager@example.com` / `password123`

**Last Updated**: 2025-12-18

---

## 開発者向けメモ

### プロジェクト構造

```
webapp/
├── src/
│   ├── db/
│   │   ├── schema.ts         # Drizzle スキーマ定義
│   │   └── client.ts         # D1クライアント
│   ├── lib/
│   │   ├── auth.ts           # 認証ロジック
│   │   ├── utils.ts          # ユーティリティ関数
│   │   ├── line.ts           # LINE API client
│   │   └── cron-todo-generation.ts  # ToDo自動生成
│   ├── middleware/
│   │   └── auth.ts           # 認証ミドルウェア
│   └── index.tsx             # メインアプリ（全ルート統合）
├── migrations/
│   └── 0000_strong_triton.sql  # DBマイグレーション
├── scripts/
│   ├── seed-db.js            # シードデータ
│   └── generate-password.js  # パスワードハッシュ生成
├── wrangler.jsonc            # Cloudflare設定
├── ecosystem.config.cjs      # PM2設定
└── package.json
```

### コマンド一覧

```bash
# 開発
npm run build                 # ビルド
npm run dev:sandbox          # 開発サーバー起動
pm2 start ecosystem.config.cjs  # PM2で起動

# データベース
npm run db:generate          # マイグレーション生成
npm run db:seed              # シードデータ投入

# Git
npm run git:commit "message" # コミット

# ポート管理
npm run clean-port           # ポート3000をクリア
```
