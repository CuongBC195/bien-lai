'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Share2, 
  Edit3, 
  Trash2, 
  LogOut, 
  FileText,
  CheckCircle2,
  Search,
  Calendar,
  Receipt as ReceiptIcon,
  Wallet,
  Clock,
  Loader2,
  Eye
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import ReceiptEditorKV from './ReceiptEditorKV';
import { ToastContainer, useToast } from './Toast';
import ShareMenu from './ShareMenu';

// Legacy ReceiptInfo
interface LegacyReceiptInfo {
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
interface DynamicField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'money';
}

// New ReceiptData structure
interface NewReceiptData {
  title: string;
  fields: DynamicField[];
  ngayThang: string;
  diaDiem: string;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
}

interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

// Combined Receipt type - supports both old and new format
interface Receipt {
  id: string;
  info?: LegacyReceiptInfo;     // Legacy format
  data?: NewReceiptData;        // New format
  signaturePoints: SignaturePoint[][] | null;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface DashboardProps {
  onLogout: () => void;
}

// Helper: Detect document type
function getDocumentType(receipt: Receipt): 'contract' | 'receipt' {
  return receipt.document ? 'contract' : 'receipt';
}

// Helper: Get display title
function getDocumentTitle(receipt: Receipt): string {
  if (receipt.document) {
    return receipt.document.title;
  }
  if (receipt.data) {
    return receipt.data.title || 'Biên nhận tiền';
  }
  return 'Biên nhận tiền';
}

// Helper function to get field value from receipt (supports both formats)
function getReceiptField(receipt: Receipt, fieldId: string): string {
  // Contract format
  if (receipt.document) {
    // For contracts, return empty or specific field if needed
    const signer = receipt.document.signers.find(s => s.role === 'Bên A' || s.role === 'Bên B');
    if (fieldId === 'hoTenNguoiNhan' && signer) return signer.name;
    return '';
  }
  // Try new receipt format
  if (receipt.data?.fields) {
    const field = receipt.data.fields.find(f => f.id === fieldId);
    if (field) return field.value;
  }
  // Fall back to legacy format
  if (receipt.info) {
    const legacyValue = receipt.info[fieldId as keyof LegacyReceiptInfo];
    return legacyValue?.toString() || '';
  }
  return '';
}

// Helper to get soTien (money amount)
function getReceiptAmount(receipt: Receipt): number {
  // Contracts don't have simple money field
  if (receipt.document) return 0;
  
  // Try new format first
  if (receipt.data?.fields) {
    const moneyField = receipt.data.fields.find(f => f.type === 'money');
    if (moneyField) {
      return parseInt(moneyField.value.replace(/\D/g, '')) || 0;
    }
  }
  // Fall back to legacy format
  if (receipt.info?.soTien) {
    return receipt.info.soTien;
  }
  return 0;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  
  // View receipt state
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  
  // Toast notification
  const { toasts, showToast, removeToast } = useToast();
  
  // Share menu state
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [shareMenuPosition, setShareMenuPosition] = useState({ x: 0, y: 0 });
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedReceiptForEmail, setSelectedReceiptForEmail] = useState<Receipt | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receipts/list');
      const data = await res.json();
      if (data.success) {
        setReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isLoggedIn');
    onLogout();
  };

  const handleCreateNew = () => {
    // Navigate to template library for new creation flow
    window.location.href = '/dashboard/create';
  };

  const handleEdit = (receipt: Receipt) => {
    // Admin has full access - can edit anything
    // Check if it's a contract or receipt
    if (receipt.document) {
      // For contracts, open in contract editor
      // Store contract data in sessionStorage for editor to load
      sessionStorage.setItem('editingContract', JSON.stringify(receipt));
      window.location.href = `/dashboard/editor?edit=${receipt.id}`;
      return;
    }
    
    // For legacy receipts, open old editor
    setEditingReceipt(receipt);
    setIsEditorOpen(true);
  };

  const handleView = (receipt: Receipt) => {
    // Mở link xem chi tiết trong tab mới
    const url = `${window.location.origin}/?id=${receipt.id}`;
    window.open(url, '_blank');
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };
  
  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/receipts/delete?id=${deleteConfirmId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadReceipts();
        showToast('Đã xóa biên nhận thành công', 'success');
      } else {
        showToast('Không thể xóa biên nhận', 'error');
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
      showToast('Có lỗi xảy ra khi xóa biên nhận', 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleShareClick = (receipt: Receipt, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setShareMenuPosition({ x: rect.right, y: rect.bottom + 8 });
    setShareMenuOpen(receipt.id);
  };

  const handleCopyLink = async (receipt: Receipt) => {
    const url = `${window.location.origin}/?id=${receipt.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Đã copy link vào clipboard', 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showToast('Không thể copy link', 'error');
    }
  };

  const handleSendEmailClick = (receipt: Receipt) => {
    setSelectedReceiptForEmail(receipt);
    setEmailAddress('');
    setEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedReceiptForEmail || !emailAddress) {
      showToast('Vui lòng nhập email', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const url = `${window.location.origin}/?id=${selectedReceiptForEmail.id}`;
      const isContract = !!selectedReceiptForEmail.document;
      const docTitle = getDocumentTitle(selectedReceiptForEmail);
      const docId = selectedReceiptForEmail.id;
      
      // Format subject based on document type
      const emailSubject = isContract 
        ? `${docTitle} - ${docId}`
        : `Biên nhận tiền - ${getReceiptField(selectedReceiptForEmail, 'hoTenNguoiNhan') || 'N/A'}`;
      
      // Get signature status to determine who needs to sign
      const sigNhan = selectedReceiptForEmail.signatureNguoiNhan || selectedReceiptForEmail.data?.signatureNguoiNhan;
      const sigGui = selectedReceiptForEmail.signatureNguoiGui || selectedReceiptForEmail.data?.signatureNguoiGui;
      
      const res = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: emailAddress,
          customerName: emailAddress.split('@')[0],
          receiptId: docId,
          documentData: isContract ? {
            type: 'contract',
            title: docTitle,
            contractNumber: selectedReceiptForEmail.document?.metadata.contractNumber,
            signers: selectedReceiptForEmail.document?.signers,
          } : undefined,
          receiptInfo: !isContract ? (selectedReceiptForEmail.info || selectedReceiptForEmail.data) : undefined,
          signingUrl: url,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi email thành công', 'success');
        setEmailModalOpen(false);
        setEmailAddress('');
        setSelectedReceiptForEmail(null);
      } else {
        showToast(data.error || 'Gửi email thất bại', 'error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Có lỗi xảy ra khi gửi email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingReceipt(null);
    loadReceipts();
  };

  const filteredReceipts = receipts.filter(r => 
    getReceiptField(r, 'hoTenNguoiNhan').toLowerCase().includes(searchTerm.toLowerCase()) ||
    getReceiptField(r, 'hoTenNguoiGui').toLowerCase().includes(searchTerm.toLowerCase()) ||
    getReceiptField(r, 'lyDoNop').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  if (isEditorOpen) {
    return (
      <ReceiptEditorKV
        receipt={editingReceipt}
        onSave={handleEditorClose}
        onCancel={handleEditorClose}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-glass">
      {/* Header */}
      <header className="glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/90 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Quản lý Biên nhận</h1>
                <p className="text-sm text-gray-500">Dashboard Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm biên nhận..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
            />
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center justify-center gap-2 px-6 py-3 glass-button rounded-xl font-medium"
          >
            <Plus className="w-5 h-5" />
            Tạo mới
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <ReceiptIcon className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Tổng biên nhận</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{receipts.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Tổng số tiền</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatNumber(receipts.reduce((sum, r) => sum + getReceiptAmount(r), 0))} <span className="text-lg font-normal text-gray-500">₫</span>
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Đã ký</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {receipts.filter(r => r.status === 'signed').length}
            </p>
          </div>
        </div>

        {/* Receipts List */}
        {loading ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Đang tải dữ liệu...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {searchTerm ? 'Không tìm thấy biên nhận' : 'Chưa có biên nhận nào'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Thử tìm với từ khóa khác' : 'Bắt đầu bằng cách tạo biên nhận mới'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 px-6 py-3 glass-button rounded-xl font-medium"
              >
                <Plus className="w-5 h-5" />
                Tạo biên nhận đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* Mobile view - Cards */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{getReceiptField(receipt, 'hoTenNguoiNhan') || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{getReceiptField(receipt, 'donViNguoiNhan') || '-'}</p>
                    </div>
                    {receipt.status === 'signed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Đã ký
                      </span>
                    ) : receipt.viewedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        <Eye className="w-3 h-3" />
                        Đã xem
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Chưa xem
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-900">
                      {formatNumber(getReceiptAmount(receipt))} ₫
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(receipt.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleView(receipt)}
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Xem
                    </button>
                    <button
                      onClick={(e) => handleShareClick(receipt, e)}
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      Chia sẻ
                    </button>
                    {shareMenuOpen === receipt.id && (
                      <ShareMenu
                        isOpen={true}
                        onClose={() => setShareMenuOpen(null)}
                        onCopyLink={() => handleCopyLink(receipt)}
                        onSendEmail={() => handleSendEmailClick(receipt)}
                        position={shareMenuPosition}
                      />
                    )}
                    <button
                      onClick={() => handleEdit(receipt)}
                      className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view - Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-200/50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tiêu đề</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bên ký</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReceipts.map((receipt) => {
                    const docType = getDocumentType(receipt);
                    const isContract = docType === 'contract';
                    
                    return (
                    <tr key={receipt.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {receipt.id}
                          </code>
                          {isContract && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium w-fit">
                              Hợp đồng
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {isContract ? getDocumentTitle(receipt) : (getReceiptField(receipt, 'hoTenNguoiNhan') || 'N/A')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {isContract 
                              ? `${receipt.document?.signers.length || 0} bên ký` 
                              : (getReceiptField(receipt, 'donViNguoiNhan') || '-')}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {isContract 
                              ? (receipt.document?.signers[0]?.name || '-')
                              : (getReceiptField(receipt, 'hoTenNguoiGui') || 'N/A')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {isContract 
                              ? (receipt.document?.signers[0]?.organization || '-')
                              : (getReceiptField(receipt, 'donViNguoiGui') || '-')}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {receipt.status === 'signed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã ký
                          </span>
                        ) : receipt.status === 'partially_signed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Ký 1 phần
                          </span>
                        ) : receipt.viewedAt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            <Eye className="w-3.5 h-3.5" />
                            Đã xem
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Chưa xem
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {formatDate(receipt.createdAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 relative">
                          <button
                            onClick={() => handleView(receipt)}
                            className="p-2.5 rounded-xl transition-all hover:bg-blue-50 text-gray-500 hover:text-blue-600"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => handleShareClick(receipt, e)}
                            className="p-2.5 rounded-xl transition-all hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                            title="Chia sẻ"
                          >
                            <Share2 className="w-5 h-5" />
                          </button>
                          {shareMenuOpen === receipt.id && (
                            <ShareMenu
                              isOpen={true}
                              onClose={() => setShareMenuOpen(null)}
                              onCopyLink={() => handleCopyLink(receipt)}
                              onSendEmail={() => handleSendEmailClick(receipt)}
                              position={shareMenuPosition}
                            />
                          )}
                          <button
                            onClick={() => handleEdit(receipt)}
                            className="p-2.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(receipt.id)}
                            className="p-2.5 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Xóa biên nhận?</h3>
                  <p className="text-sm text-gray-500">Link chia sẻ sẽ không còn hoạt động</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    'Xóa'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {emailModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gửi email mời ký</h3>
              <p className="text-sm text-gray-500 mb-4">
                Biên nhận: <span className="font-medium">{selectedReceiptForEmail?.id}</span>
              </p>
              <input
                type="email"
                placeholder="Nhập địa chỉ email..."
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEmailModalOpen(false);
                    setEmailAddress('');
                    setSelectedReceiptForEmail(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailAddress}
                  className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    'Gửi email'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </main>
    </div>
  );
}
