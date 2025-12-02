'use client';

import { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Mail,
  X,
  User,
  Building,
  FileText,
  DollarSign,
  Calendar,
  Loader2
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface ReceiptInfo {
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

interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

interface Receipt {
  id: string;
  info: ReceiptInfo;
  signaturePoints: SignaturePoint[][] | null;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptEditorKVProps {
  receipt?: Receipt | null;
  onSave: () => void;
  onCancel: () => void;
}

// Convert number to Vietnamese words
function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không đồng';
  
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const positions = ['', 'nghìn', 'triệu', 'tỷ'];
  
  const readGroup = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;
    
    let result = '';
    
    if (hundred > 0) {
      result += units[hundred] + ' trăm ';
    }
    
    if (ten > 1) {
      result += units[ten] + ' mươi ';
      if (unit === 1) result += 'mốt ';
      else if (unit === 5) result += 'lăm ';
      else if (unit > 0) result += units[unit] + ' ';
    } else if (ten === 1) {
      result += 'mười ';
      if (unit === 5) result += 'lăm ';
      else if (unit > 0) result += units[unit] + ' ';
    } else if (unit > 0) {
      if (hundred > 0) result += 'lẻ ';
      result += units[unit] + ' ';
    }
    
    return result.trim();
  };
  
  let result = '';
  let groupIndex = 0;
  
  while (num > 0) {
    const group = num % 1000;
    if (group > 0) {
      const groupStr = readGroup(group);
      result = groupStr + ' ' + positions[groupIndex] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    groupIndex++;
  }
  
  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

export default function ReceiptEditorKV({ receipt, onSave, onCancel }: ReceiptEditorKVProps) {
  const isEditing = !!receipt;
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  const [formData, setFormData] = useState<ReceiptInfo>({
    hoTenNguoiNhan: receipt?.info?.hoTenNguoiNhan || '',
    hoTenNguoiGui: receipt?.info?.hoTenNguoiGui || '',
    donViNguoiNhan: receipt?.info?.donViNguoiNhan || '',
    donViNguoiGui: receipt?.info?.donViNguoiGui || '',
    lyDoNop: receipt?.info?.lyDoNop || '',
    soTien: receipt?.info?.soTien || 0,
    bangChu: receipt?.info?.bangChu || '',
    ngayThang: receipt?.info?.ngayThang || new Date().toLocaleDateString('vi-VN'),
    diaDiem: receipt?.info?.diaDiem || '',
  });

  const [saving, setSaving] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(receipt?.id || null);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'soTien') {
      const numValue = parseInt(value.replace(/\D/g, '')) || 0;
      setFormData(prev => ({
        ...prev,
        soTien: numValue,
        bangChu: numberToVietnameseWords(numValue),
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Clear signature
  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  // Save receipt
  const handleSave = async () => {
    setSaving(true);
    try {
      // Get signature points if any
      let signaturePoints = null;
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        signaturePoints = sigCanvas.current.toData();
      }

      const url = isEditing ? '/api/receipts/update' : '/api/receipts/create';
      const body = isEditing 
        ? { id: receipt.id, info: formData, signaturePoints }
        : { info: formData, signaturePoints };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (data.success) {
        setSavedReceiptId(data.receipt?.id || receipt?.id);
        alert(isEditing ? 'Đã cập nhật biên lai!' : 'Đã tạo biên lai mới!');
        onSave();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Có lỗi xảy ra khi lưu!');
    } finally {
      setSaving(false);
    }
  };

  // Send invitation email
  const handleSendEmail = async () => {
    if (!customerEmail) {
      alert('Vui lòng nhập email!');
      return;
    }

    setSendingEmail(true);
    try {
      // First save if not saved yet
      let receiptId = savedReceiptId;
      if (!receiptId) {
        const createRes = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ info: formData }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          throw new Error(createData.error);
        }
        receiptId = createData.receipt.id;
        setSavedReceiptId(receiptId);
      }

      // Send invitation
      const signingUrl = `${window.location.origin}/?id=${receiptId}`;
      const res = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail,
          customerName: formData.hoTenNguoiGui,
          receiptInfo: formData,
          signingUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Đã gửi email mời ký thành công!');
        setShowEmailPanel(false);
        setCustomerEmail('');
      } else {
        alert('Lỗi gửi email: ' + data.error);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Có lỗi xảy ra khi gửi email!');
    } finally {
      setSendingEmail(false);
    }
  };

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-glass p-4 md:p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="glass-card rounded-2xl p-4 flex justify-between items-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Quay lại</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Chỉnh sửa: ${receipt.id}` : 'Tạo biên nhận mới'}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEmailPanel(true)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-gray-900"
              title="Gửi email mời ký"
            >
              <Mail className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Email Panel */}
      {showEmailPanel && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Gửi email mời ký
              </h2>
              <button
                onClick={() => setShowEmailPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email khách hàng</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="w-full glass-button py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Gửi email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl p-6 space-y-6">
          {/* Người nhận */}
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
              <User className="w-4 h-4" />
              Bên nhận tiền
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên người nhận</label>
                <input
                  type="text"
                  name="hoTenNguoiNhan"
                  value={formData.hoTenNguoiNhan}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
                <input
                  type="text"
                  name="donViNguoiNhan"
                  value={formData.donViNguoiNhan}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
            </div>
          </div>

          {/* Người gửi */}
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
              <Building className="w-4 h-4" />
              Bên gửi tiền (Khách hàng ký)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên người gửi</label>
                <input
                  type="text"
                  name="hoTenNguoiGui"
                  value={formData.hoTenNguoiGui}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
                <input
                  type="text"
                  name="donViNguoiGui"
                  value={formData.donViNguoiGui}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
            </div>
          </div>

          {/* Thông tin giao dịch */}
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
              <DollarSign className="w-4 h-4" />
              Thông tin giao dịch
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lý do nộp tiền</label>
              <textarea
                name="lyDoNop"
                value={formData.lyDoNop}
                onChange={handleChange}
                rows={2}
                className="w-full glass-input rounded-xl px-4 py-2.5 resize-none"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                <input
                  type="text"
                  name="soTien"
                  value={formatCurrency(formData.soTien)}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-orange-600 font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bằng chữ</label>
                <input
                  type="text"
                  name="bangChu"
                  value={formData.bangChu}
                  readOnly
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-gray-500 italic bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Địa điểm & Ngày tháng */}
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
              <Calendar className="w-4 h-4" />
              Thời gian & Địa điểm
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tháng</label>
                <input
                  type="text"
                  name="ngayThang"
                  value={formData.ngayThang}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm</label>
                <input
                  type="text"
                  name="diaDiem"
                  value={formData.diaDiem}
                  onChange={handleChange}
                  className="w-full glass-input rounded-xl px-4 py-2.5"
                />
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
              <FileText className="w-4 h-4" />
              Chữ ký (Admin ký trước - tùy chọn)
            </h3>
            <div className="border border-gray-200 rounded-xl p-2 bg-white">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: 'w-full h-40 bg-white rounded-lg',
                  style: { width: '100%', height: '160px' }
                }}
                backgroundColor="white"
              />
            </div>
            <button
              onClick={clearSignature}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Xóa chữ ký
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onCancel}
              className="flex-1 py-3 glass-button-outline rounded-xl font-medium"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 glass-button rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Cập nhật' : 'Tạo biên nhận'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
