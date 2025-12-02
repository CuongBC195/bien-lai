import Redis from 'ioredis';
import { customAlphabet } from 'nanoid';

// Redis connection using REDIS_URL
const redis = new Redis(process.env.REDIS_URL || '');

// Custom ID generator với tiền tố 3DO-
const generateId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

export function createReceiptId(): string {
  return `3DO-${generateId()}`;
}

// Types
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

export interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

export interface Receipt {
  id: string;
  info: ReceiptInfo;
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
export async function createReceipt(
  info: ReceiptInfo,
  signaturePoints?: SignaturePoint[][] | null,
  signatureNguoiNhan?: string
): Promise<Receipt> {
  const id = createReceiptId();
  const receipt: Receipt = {
    id,
    info,
    signaturePoints: signaturePoints || null,
    signatureNguoiNhan: signatureNguoiNhan || undefined,
    status: signaturePoints ? 'signed' : 'pending',
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
  signaturePoints: SignaturePoint[][],
  signatureNguoiGui?: string
): Promise<Receipt | null> {
  return await updateReceipt(id, {
    signaturePoints,
    signatureNguoiGui: signatureNguoiGui || undefined,
    status: 'signed',
    signedAt: Date.now(),
  });
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
