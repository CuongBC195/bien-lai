// LocalStorage helper for receipts management

export interface ReceiptData {
  id: string;
  hoTenNguoiNhan: string;
  hoTenNguoiGui: string;
  donViNguoiNhan: string;
  donViNguoiGui: string;
  lyDoNop: string;
  soTien: number;
  bangChu: string;
  ngayThang: string;
  diaDiem: string;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'receipts_v1';

export const generateId = (): string => {
  return `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getReceipts = (): ReceiptData[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveReceipt = (receipt: Omit<ReceiptData, 'id' | 'createdAt' | 'updatedAt'>): ReceiptData => {
  const receipts = getReceipts();
  const newReceipt: ReceiptData = {
    ...receipt,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  receipts.unshift(newReceipt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  return newReceipt;
};

export const updateReceipt = (id: string, data: Partial<ReceiptData>): ReceiptData | null => {
  const receipts = getReceipts();
  const index = receipts.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  receipts[index] = {
    ...receipts[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  return receipts[index];
};

export const deleteReceipt = (id: string): boolean => {
  const receipts = getReceipts();
  const filtered = receipts.filter(r => r.id !== id);
  if (filtered.length === receipts.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

export const getReceiptById = (id: string): ReceiptData | null => {
  const receipts = getReceipts();
  return receipts.find(r => r.id === id) || null;
};
