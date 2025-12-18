import { nanoid } from 'nanoid';

/**
 * ユニークIDの生成
 */
export function generateId(prefix?: string): string {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * 登録コードの生成（4-6桁）
 */
export function generateRegistrationCode(length: number = 6): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * LINE署名検証（Web Crypto API使用）
 */
export async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    return hashBase64 === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * テンプレート変数の置換
 */
export function replaceTemplateVariables(
  template: string,
  variables: {
    callName?: string;
    castName?: string;
    lastVisit?: string;
    storeName?: string;
  }
): string {
  let result = template;
  
  if (variables.callName) {
    result = result.replace(/{callName}/g, variables.callName);
  }
  if (variables.castName) {
    result = result.replace(/{castName}/g, variables.castName);
  }
  if (variables.lastVisit) {
    result = result.replace(/{lastVisit}/g, variables.lastVisit);
  }
  if (variables.storeName) {
    result = result.replace(/{storeName}/g, variables.storeName);
  }
  
  return result;
}

/**
 * 送信可能時間帯チェック
 */
export function isWithinAllowedSendingTime(
  startTime: string, // HH:mm
  endTime: string, // HH:mm
  currentDate: Date = new Date()
): boolean {
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const endMinutes = endHour * 60 + endMinute;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * 送信頻度制限チェック
 */
export function canSendMessage(
  lastMessageSentAt: Date | null,
  frequencyLimitHours: number
): boolean {
  if (!lastMessageSentAt) return true;
  
  const now = new Date();
  const diffMs = now.getTime() - lastMessageSentAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours >= frequencyLimitHours;
}

/**
 * 日付フォーマット（YYYY-MM-DD）
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 日時フォーマット（YYYY-MM-DD HH:mm）
 */
export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 日付計算（n日前）
 */
export function daysAgo(days: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * 日付計算（n日後）
 */
export function daysLater(days: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 当日終了時刻（23:59:59）
 */
export function endOfDay(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
