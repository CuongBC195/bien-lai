// URL compression utilities using lz-string
import LZString from 'lz-string';
import { ReceiptData } from './storage';

export type ShareableReceiptData = Omit<ReceiptData, 'id' | 'createdAt' | 'updatedAt'> & {
  receiptId?: string; // Optional: ID to fetch full receipt from LocalStorage
};

export const compressData = (data: ShareableReceiptData): string => {
  const jsonStr = JSON.stringify(data);
  return LZString.compressToEncodedURIComponent(jsonStr);
};

export const decompressData = (compressed: string): ShareableReceiptData | null => {
  try {
    const jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as ShareableReceiptData;
  } catch {
    return null;
  }
};

export const generateShareUrl = (data: ShareableReceiptData): string => {
  const compressed = compressData(data);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}?data=${compressed}`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};
