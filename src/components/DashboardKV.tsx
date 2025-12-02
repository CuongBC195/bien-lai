'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  LogOut, 
  FileText,
  Check,
  Clock,
  Share2,
  Mail
} from 'lucide-react';
import ReceiptEditorKV from './ReceiptEditorKV';
import { Toast, ToastContainer, ToastItem } from './Toast';
import ShareMenu from './ShareMenu';

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

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  // ShareMenu state
  const [shareMenuReceipt, setShareMenuReceipt] = useState<Receipt | null>(null);
  const [shareMenuPosition, setShareMenuPosition] = useState({ x: 0, y: 0 });
  
  // Email panel state
  const [emailPanelReceipt, setEmailPanelReceipt] = useState<Receipt | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch receipts
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receipts/list');
      const data = await res.json();
      if (data.success) {
        setReceipts(data.receipts);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  // Delete receipt
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/receipts/delete?id=${deleteConfirmId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setReceipts(receipts.filter(r => r.id !== deleteConfirmId));
        showToast('Đã xóa biên lai!', 'success');
      } else {
        showToast('Không thể xóa biên lai!', 'error');
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
      showToast('Lỗi khi xóa biên lai!', 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // Open share menu
  const handleShareClick = (receipt: Receipt, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setShareMenuPosition({ x: rect.left, y: rect.bottom + 4 });
    setShareMenuReceipt(receipt);
  };
  
  // Copy share link
  const handleCopyLink = async (id: string) => {
    const url = `${window.location.origin}/?id=${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('Đã sao chép link!', 'success');
    setShareMenuReceipt(null);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  // Open email panel
  const handleOpenEmailPanel = (receipt: Receipt) => {
    setEmailPanelReceipt(receipt);
    setEmailTo('');
    setShareMenuReceipt(null);
  };
  
  // Send invitation email
  const handleSendInvitation = async () => {
    if (!emailPanelReceipt || !emailTo.trim()) {
      showToast('Vui lòng nhập email!', 'error');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo)) {
      showToast('Email không hợp lệ!', 'error');
      return;
    }
    
    setEmailSending(true);
    try {
      const res = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: emailPanelReceipt.id,
          email: emailTo,
          senderName: emailPanelReceipt.info?.hoTenNguoiNhan || 'Admin'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi email thành công!', 'success');
        setEmailPanelReceipt(null);
      } else {
        showToast(data.error || 'Không thể gửi email!', 'error');
      }
    } catch {
      showToast('Lỗi khi gửi email!', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle save (create/update)
  const handleSave = async () => {
    setIsCreating(false);
    setEditingReceipt(null);
    await fetchReceipts();
  };

  // Show editor
  if (isCreating || editingReceipt) {
    return (
      <ReceiptEditorKV
        receipt={editingReceipt}
        onSave={handleSave}
        onCancel={() => {
          setIsCreating(false);
          setEditingReceipt(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="glass-dark rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-light text-white flex items-center gap-2">
              <FileText className="w-6 h-6" />
              E-Receipt Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Quản lý biên lai điện tử với Vercel KV
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCreating(true)}
              className="glass-button flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo mới</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-light text-white">{receipts.length}</div>
          <div className="text-gray-400 text-sm">Tổng biên lai</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-light text-green-400">
            {receipts.filter(r => r.status === 'signed').length}
          </div>
          <div className="text-gray-400 text-sm">Đã ký</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-light text-yellow-400">
            {receipts.filter(r => r.status === 'pending').length}
          </div>
          <div className="text-gray-400 text-sm">Chờ ký</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-light text-blue-400">
            {formatCurrency(receipts.reduce((sum, r) => sum + (r.info?.soTien || 0), 0))}
          </div>
          <div className="text-gray-400 text-sm">Tổng giá trị</div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto">
        <div className="glass-dark rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
              Đang tải...
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có biên lai nào</p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 text-blue-400 hover:text-blue-300"
              >
                Tạo biên lai đầu tiên →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">ID</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Người gửi</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm hidden md:table-cell">Số tiền</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Trạng thái</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm hidden lg:table-cell">Ngày tạo</th>
                    <th className="text-right p-4 text-gray-400 font-medium text-sm">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <code className="text-blue-400 text-sm bg-blue-400/10 px-2 py-1 rounded">
                          {receipt.id}
                        </code>
                      </td>
                      <td className="p-4">
                        <div className="text-white">{receipt.info?.hoTenNguoiGui || 'N/A'}</div>
                        <div className="text-gray-500 text-sm">{receipt.info?.donViNguoiGui || ''}</div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-amber-400 font-medium">
                          {formatCurrency(receipt.info?.soTien || 0)}
                        </span>
                      </td>
                      <td className="p-4">
                        {receipt.status === 'signed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                            <Check className="w-3 h-3" />
                            Đã ký
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                            <Clock className="w-3 h-3" />
                            Chờ ký
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 text-sm hidden lg:table-cell">
                        {formatDate(receipt.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={(e) => handleShareClick(receipt, e)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white relative"
                            title="Chia sẻ"
                          >
                            {copiedId === receipt.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingReceipt(receipt)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(receipt.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Share Menu */}
      {shareMenuReceipt && (
        <ShareMenu
          isOpen={!!shareMenuReceipt}
          onClose={() => setShareMenuReceipt(null)}
          onCopyLink={() => handleCopyLink(shareMenuReceipt.id)}
          onSendEmail={() => handleOpenEmailPanel(shareMenuReceipt)}
          position={shareMenuPosition}
        />
      )}
      
      {/* Email Panel Modal */}
      {emailPanelReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEmailPanelReceipt(null)}
          />
          <div className="relative bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Gửi link qua email
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Gửi lời mời ký biên lai đến người nhận
            </p>
            <input
              type="email"
              placeholder="Nhập email người nhận..."
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEmailPanelReceipt(null)}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSendInvitation}
                disabled={emailSending}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {emailSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Gửi email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Xóa biên lai?</h3>
                <p className="text-gray-400 text-sm">Link chia sẻ sẽ không còn hoạt động</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
      
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
