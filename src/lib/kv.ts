import Redis from 'ioredis';
import { customAlphabet } from 'nanoid';

// Custom ID generator với tiền tố 3DO-
const generateId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export function createReceiptId(): string {
  return `3DO-${generateId()}`;
}

// Redis client singleton
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    redis = new Redis(redisUrl);
  }
  return redis;
}

// Types - Legacy format (for backward compatibility)
export interface ReceiptInfo {
  hoTenNguoiNhan: string;
  hoTenNguoiGui: string;
  donViNguoiNhan: string;
  donViNguoiGui: string;
  lyDoNop: string;
  soTien: number;
  bangChu: string;
  ngayThang: string;
  diaDiem: string;
}

// New dynamic field structure
export interface DynamicField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'money';
}

// New receipt data structure
export interface ReceiptData {
  title: string;
  fields: DynamicField[];
  ngayThang: string;
  diaDiem: string;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  // Actual signature data for server-side rendering
  signatureDataNguoiNhan?: SignatureData;
  signatureDataNguoiGui?: SignatureData;
}

export interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

// New signature data structure - stores only data, no base64
export interface SignatureData {
  type: 'draw' | 'type';
  signaturePoints?: SignaturePoint[][] | null;
  typedText?: string;
  fontFamily?: string;
  color?: string;
}

export interface Receipt {
  id: string;
  // Support both old and new format
  info?: ReceiptInfo;  // Legacy format
  data?: ReceiptData;  // New format
  signaturePoints: SignaturePoint[][] | null; // Legacy - deprecated
  // New signature storage - only data, no base64
  signatureDataNguoiNhan?: SignatureData;
  signatureDataNguoiGui?: SignatureData;
  // Legacy base64 fields - for backward compatibility
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

// Redis Keys
const RECEIPT_KEY = (id: string) => `receipt:${id}`;
const ADMIN_LIST_KEY = 'admin:receipt_ids';

// CRUD Operations

// Create receipt with new ReceiptData format
export async function createReceipt(
  infoOrData: ReceiptInfo | ReceiptData,
  signaturePoints?: SignaturePoint[][] | null,
  signatureNguoiNhan?: string,
  signatureNguoiGui?: string
): Promise<Receipt> {
  const id = createReceiptId();
  const redis = getRedis();
  
  // Detect if it's new format (has 'fields' array) or legacy format
  const isNewFormat = 'fields' in infoOrData;
  
  const receipt: Receipt = {
    id,
    ...(isNewFormat 
      ? { data: infoOrData as ReceiptData }
      : { info: infoOrData as ReceiptInfo }
    ),
    signaturePoints: signaturePoints || null,
    signatureNguoiNhan: signatureNguoiNhan || (isNewFormat ? (infoOrData as ReceiptData).signatureNguoiNhan : undefined),
    signatureNguoiGui: signatureNguoiGui || (isNewFormat ? (infoOrData as ReceiptData).signatureNguoiGui : undefined),
    // Store actual signature data for server-side rendering
    signatureDataNguoiNhan: isNewFormat ? (infoOrData as ReceiptData).signatureDataNguoiNhan : undefined,
    signatureDataNguoiGui: isNewFormat ? (infoOrData as ReceiptData).signatureDataNguoiGui : undefined,
    status: 'pending',
    createdAt: Date.now(),
  };

  // Lưu receipt
  await redis.set(RECEIPT_KEY(id), JSON.stringify(receipt));
  
  // Thêm ID vào list admin (thêm vào đầu)
  await redis.lpush(ADMIN_LIST_KEY, id);

  return receipt;
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const redis = getRedis();
  const data = await redis.get(RECEIPT_KEY(id));
  if (!data) return null;
  return JSON.parse(data) as Receipt;
}

export async function updateReceipt(
  id: string,
  updates: Partial<Receipt>
): Promise<Receipt | null> {
  const receipt = await getReceipt(id);
  if (!receipt) return null;

  const redis = getRedis();
  const updated = { ...receipt, ...updates };
  await redis.set(RECEIPT_KEY(id), JSON.stringify(updated));
  return updated;
}

export async function signReceipt(
  id: string,
  signatureDataNguoiGui?: SignatureData,
  signatureDataNguoiNhan?: SignatureData
): Promise<Receipt | null> {
  const updates: Partial<Receipt> = {
    status: 'signed',
    signedAt: Date.now(),
  };
  
  if (signatureDataNguoiGui) {
    updates.signatureDataNguoiGui = signatureDataNguoiGui;
    // Also set legacy signaturePoints for backward compat
    if (signatureDataNguoiGui.type === 'draw' && signatureDataNguoiGui.signaturePoints) {
      updates.signaturePoints = signatureDataNguoiGui.signaturePoints;
    }
  }
  
  if (signatureDataNguoiNhan) {
    updates.signatureDataNguoiNhan = signatureDataNguoiNhan;
  }
  
  return await updateReceipt(id, updates);
}

export async function deleteReceipt(id: string): Promise<boolean> {
  const redis = getRedis();
  // Xóa receipt
  await redis.del(RECEIPT_KEY(id));
  
  // Xóa khỏi list admin
  await redis.lrem(ADMIN_LIST_KEY, 0, id);

  return true;
}

export async function getAllReceiptIds(): Promise<string[]> {
  const redis = getRedis();
  return (await redis.lrange(ADMIN_LIST_KEY, 0, -1)) || [];
}

export async function getAllReceipts(): Promise<Receipt[]> {
  const ids = await getAllReceiptIds();
  if (ids.length === 0) return [];

  // Fetch all receipts in parallel
  const receipts = await Promise.all(
    ids.map((id) => getReceipt(id))
  );

  // Filter out null values (deleted receipts)
  return receipts.filter((r): r is Receipt => r !== null);
}

export { getRedis as getRedisClient };
