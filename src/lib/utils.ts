// Utility functions for Vietnamese money handling

// Đọc số thành chữ tiếng Việt
const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

function readThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100);
  const ten = Math.floor((num % 100) / 10);
  const one = num % 10;
  
  let result = '';
  
  if (hundred > 0) {
    result += ones[hundred] + ' trăm';
    if (ten === 0 && one > 0) {
      result += ' lẻ';
    }
  }
  
  if (ten > 0) {
    result += ' ' + tens[ten];
    if (ten === 1 && one > 0) {
      result = result.replace('mười', 'mười');
    }
    if (one === 1 && ten > 1) {
      result += ' mốt';
      return result.trim();
    }
    if (one === 5 && ten >= 1) {
      result += ' lăm';
      return result.trim();
    }
  }
  
  if (one > 0 && !(one === 1 && ten > 1) && !(one === 5 && ten >= 1)) {
    result += ' ' + ones[one];
  }
  
  return result.trim();
}

export function numberToVietnamese(num: number): string {
  if (num === 0) return 'không đồng';
  if (num < 0) return 'âm ' + numberToVietnamese(-num);
  
  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  let result = '';
  let unitIndex = 0;
  
  while (num > 0) {
    const threeDigits = num % 1000;
    if (threeDigits > 0) {
      const readPart = readThreeDigits(threeDigits);
      result = readPart + units[unitIndex] + (result ? ' ' + result : '');
    }
    num = Math.floor(num / 1000);
    unitIndex++;
  }
  
  // Capitalize first letter and add "đồng"
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  
  return result;
}

// Format số tiền VND
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

// Format số với dấu chấm phân cách
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

// Parse số từ string có format
export function parseFormattedNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Format ngày tháng tiếng Việt
export function formatVietnameseDate(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `ngày ${day} tháng ${month} năm ${year}`;
}

// CN utility for classnames
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
