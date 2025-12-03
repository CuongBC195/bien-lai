import Redis from 'ioredis';
import { customAlphabet } from 'nanoid';

// Redis connection using REDIS_URL
const redis = new Redis(process.env.REDIS_URL || '');

// Custom ID generator với tiền tố 3DO-
const generateId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

export function createReceiptId(): string {
  return `3DO-${generateId()}`;
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
}

export interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

export interface Receipt {
  id: string;
  // Support both old and new format
  info?: ReceiptInfo;  // Legacy format
  data?: ReceiptData;  // New format
  signaturePoints: SignaturePoint[][] | null;
  signatureNguoiNhan?: string; // Chữ ký admin (base64)
  signatureNguoiGui?: string; // Chữ ký khách (base64)
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

  const updated = { ...receipt, ...updates };
  await redis.set(RECEIPT_KEY(id), JSON.stringify(updated));
  return updated;
}

export async function signReceipt(
  id: string,
  signaturePoints?: SignaturePoint[][],
  signatureNguoiGui?: string,
  signatureNguoiNhan?: string
): Promise<Receipt | null> {
  const updates: Partial<Receipt> = {
    status: 'signed',
    signedAt: Date.now(),
  };
  
  if (signaturePoints && signaturePoints.length > 0) {
    updates.signaturePoints = signaturePoints;
  }
  if (signatureNguoiGui) {
    updates.signatureNguoiGui = signatureNguoiGui;
  }
  if (signatureNguoiNhan) {
    updates.signatureNguoiNhan = signatureNguoiNhan;
  }
  
  return await updateReceipt(id, updates);
}

export async function deleteReceipt(id: string): Promise<boolean> {
  // Xóa receipt
  await redis.del(RECEIPT_KEY(id));
  
  // Xóa khỏi list admin
  await redis.lrem(ADMIN_LIST_KEY, 0, id);

  return true;
}

export async function getAllReceiptIds(): Promise<string[]> {
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

export { redis };
