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
    // Ưu tiên REDIS_URL_NEW (Upstash mới), fallback về REDIS_URL cũ
    const redisUrl = process.env.REDIS_URL_NEW || process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL_NEW or REDIS_URL environment variable is not set');
    }
    
    // Cấu hình cho Vercel serverless + Upstash
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3, // Giảm số lần retry (mặc định 20)
      enableReadyCheck: false, // Bỏ qua ready check cho serverless
      connectTimeout: 10000, // 10 giây timeout
      lazyConnect: true, // Chỉ connect khi cần
    });

    // Xử lý lỗi để không crash serverless function
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
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

// NEW: Signer definition for contracts
export interface Signer {
  id: string;
  role: string; // 'Bên A', 'Bên B', 'Người vay', 'Người cho vay', etc.
  name: string;
  position?: string; // Chức vụ
  organization?: string; // Tổ chức/công ty
  idNumber?: string; // CMND/CCCD
  phone?: string;
  email?: string;
  address?: string;
  signed: boolean;
  signedAt?: number;
  signatureData?: SignatureData;
}

// NEW: Contract/Document data structure
export interface DocumentData {
  type: 'receipt' | 'contract'; // Phân biệt loại văn bản
  templateId?: string; // ID của mẫu (nếu dùng mẫu)
  title: string; // Tiêu đề hợp đồng
  content: string; // HTML string - Nội dung văn bản đầy đủ
  signers: Signer[]; // Danh sách người ký
  metadata: {
    contractNumber?: string; // Số hợp đồng
    createdDate: string; // Ngày lập
    effectiveDate?: string; // Ngày hiệu lực
    expiryDate?: string; // Ngày hết hạn
    location: string; // Địa điểm ký
    [key: string]: any; // Metadata khác
  };
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
  data?: ReceiptData;  // New format (receipts)
  document?: DocumentData; // NEW: Contract/Document format
  signaturePoints: SignaturePoint[][] | null; // Legacy - deprecated
  // New signature storage - only data, no base64
  signatureDataNguoiNhan?: SignatureData;
  signatureDataNguoiGui?: SignatureData;
  // Legacy base64 fields - for backward compatibility
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status: 'pending' | 'signed' | 'partially_signed'; // NEW: Thêm trạng thái ký 1 phần
  createdAt: number;
  signedAt?: number;
  viewedAt?: number; // NEW: Tracking when customer first viewed
  pdfUrl?: string; // NEW: URL của file PDF đã tạo (nếu có)
  userId?: string; // NEW: User who created this document (undefined = admin)
}

// User interface
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: number;
  createdAt: number;
  lastLoginAt?: number;
}

// Redis Keys
const RECEIPT_KEY = (id: string) => `receipt:${id}`;
const ADMIN_LIST_KEY = 'admin:receipt_ids';
const USER_KEY = (id: string) => `user:${id}`;
const USER_EMAIL_KEY = (email: string) => `user:email:${email.toLowerCase()}`;
const USER_LIST_KEY = 'users:list';
const USER_RECEIPTS_KEY = (userId: string) => `user:${userId}:receipt_ids`;

// CRUD Operations

// Create receipt with new ReceiptData format
export async function createReceipt(
  infoOrData: ReceiptInfo | ReceiptData | DocumentData,
  signaturePoints?: SignaturePoint[][] | null,
  signatureNguoiNhan?: string,
  signatureNguoiGui?: string,
  userId?: string // NEW: Optional user ID
): Promise<Receipt> {
  const id = createReceiptId();
  const redis = getRedis();
  
  // Detect format type
  const isDocumentFormat = 'type' in infoOrData && infoOrData.type === 'contract';
  const isNewReceiptFormat = 'fields' in infoOrData && !isDocumentFormat;
  const isLegacyFormat = !isDocumentFormat && !isNewReceiptFormat;
  
  const receipt: Receipt = {
    id,
    ...(isDocumentFormat 
      ? { document: infoOrData as DocumentData }
      : isNewReceiptFormat 
        ? { data: infoOrData as ReceiptData }
        : { info: infoOrData as ReceiptInfo }
    ),
    signaturePoints: signaturePoints || null,
    signatureNguoiNhan: signatureNguoiNhan || (isNewReceiptFormat ? (infoOrData as ReceiptData).signatureNguoiNhan : undefined),
    signatureNguoiGui: signatureNguoiGui || (isNewReceiptFormat ? (infoOrData as ReceiptData).signatureNguoiGui : undefined),
    // Store actual signature data for server-side rendering
    signatureDataNguoiNhan: isNewReceiptFormat ? (infoOrData as ReceiptData).signatureDataNguoiNhan : undefined,
    signatureDataNguoiGui: isNewReceiptFormat ? (infoOrData as ReceiptData).signatureDataNguoiGui : undefined,
    status: 'pending',
    createdAt: Date.now(),
    userId, // NEW: Store user ID
  };

  // Lưu receipt
  await redis.set(RECEIPT_KEY(id), JSON.stringify(receipt));
  
  // Thêm ID vào list admin (thêm vào đầu) - Admin luôn xem được tất cả
  await redis.lpush(ADMIN_LIST_KEY, id);
  
  // Nếu có userId, thêm vào user's receipt list
  if (userId) {
    await redis.lpush(USER_RECEIPTS_KEY(userId), id);
  }

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
  
  // Get receipt to check userId before deleting
  const receipt = await getReceipt(id);
  
  // Xóa receipt
  await redis.del(RECEIPT_KEY(id));
  
  // Xóa khỏi list admin
  await redis.lrem(ADMIN_LIST_KEY, 0, id);
  
  // Xóa khỏi list user nếu có userId
  if (receipt?.userId) {
    await redis.lrem(USER_RECEIPTS_KEY(receipt.userId), 0, id);
  }

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

// Get receipts for a specific user
export async function getUserReceipts(userId: string): Promise<Receipt[]> {
  const redis = getRedis();
  const ids = await redis.lrange(USER_RECEIPTS_KEY(userId), 0, -1);
  if (ids.length === 0) return [];

  const receipts = await Promise.all(
    ids.map((id) => getReceipt(id))
  );

  return receipts.filter((r): r is Receipt => r !== null);
}

// User CRUD Operations
export async function createUser(email: string, passwordHash: string, name: string, verificationToken: string): Promise<User> {
  const redis = getRedis();
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    name,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    createdAt: Date.now(),
  };

  await redis.set(USER_KEY(userId), JSON.stringify(user));
  await redis.set(USER_EMAIL_KEY(email.toLowerCase()), userId);
  await redis.lpush(USER_LIST_KEY, userId);

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  const redis = getRedis();
  const data = await redis.get(USER_KEY(id));
  if (!data) return null;
  return JSON.parse(data) as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const redis = getRedis();
  const userId = await redis.get(USER_EMAIL_KEY(email.toLowerCase()));
  if (!userId) return null;
  return getUserById(userId);
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const user = await getUserById(id);
  if (!user) return null;

  const redis = getRedis();
  const updated = { ...user, ...updates };
  await redis.set(USER_KEY(id), JSON.stringify(updated));
  
  // Update email index if email changed
  if (updates.email && updates.email !== user.email) {
    await redis.del(USER_EMAIL_KEY(user.email));
    await redis.set(USER_EMAIL_KEY(updates.email.toLowerCase()), id);
  }

  return updated;
}

export async function deleteUserReceipt(userId: string, receiptId: string): Promise<void> {
  const redis = getRedis();
  await redis.lrem(USER_RECEIPTS_KEY(userId), 0, receiptId);
}

export async function getAllUsers(): Promise<User[]> {
  const redis = getRedis();
  const userIds = await redis.lrange(USER_LIST_KEY, 0, -1);
  if (userIds.length === 0) return [];

  const users = await Promise.all(
    userIds.map((id) => getUserById(id))
  );

  return users.filter((u): u is User => u !== null);
}

export async function deleteUser(userId: string): Promise<boolean> {
  const redis = getRedis();
  const user = await getUserById(userId);
  if (!user) return false;

  // Delete user
  await redis.del(USER_KEY(userId));
  await redis.del(USER_EMAIL_KEY(user.email));
  await redis.lrem(USER_LIST_KEY, 0, userId);

  // Delete user's receipts list (but keep receipts themselves)
  await redis.del(USER_RECEIPTS_KEY(userId));

  return true;
}

export { getRedis as getRedisClient };
