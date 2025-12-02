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
  Receipt,
  Wallet,
  Clock,
  Loader2
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import ReceiptEditorKV from './ReceiptEditorKV';

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

interface ReceiptData {
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
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setEditingReceipt(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (receipt: ReceiptData) => {
    setEditingReceipt(receipt);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa biên nhận này?')) {
      try {
        const res = await fetch(`/api/receipts/delete?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          await loadReceipts();
        }
      } catch (error) {
        console.error('Error deleting receipt:', error);
      }
    }
  };

  const handleShare = async (receipt: ReceiptData) => {
    const url = `${window.location.origin}/?id=${receipt.id}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(receipt.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingReceipt(null);
    loadReceipts();
  };

  const filteredReceipts = receipts.filter(r => 
    (r.info?.hoTenNguoiNhan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.info?.hoTenNguoiGui || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.info?.lyDoNop || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                <Receipt className="w-5 h-5 text-gray-700" />
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
              {formatNumber(receipts.reduce((sum, r) => sum + (r.info?.soTien || 0), 0))} <span className="text-lg font-normal text-gray-500">₫</span>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-200/50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Người nhận</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Người gửi</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Số tiền</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {receipt.id}
                        </code>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{receipt.info?.hoTenNguoiNhan || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{receipt.info?.donViNguoiNhan || '-'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{receipt.info?.hoTenNguoiGui || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{receipt.info?.donViNguoiGui || '-'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">
                          {formatNumber(receipt.info?.soTien || 0)} ₫
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {receipt.status === 'signed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã ký
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Chờ ký
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleShare(receipt)}
                            className={`p-2.5 rounded-xl transition-all ${
                              copiedId === receipt.id 
                                ? 'bg-green-100 text-green-700' 
                                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                            }`}
                            title={copiedId === receipt.id ? 'Đã copy!' : 'Lấy link chia sẻ'}
                          >
                            {copiedId === receipt.id ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Share2 className="w-5 h-5" />
                            )}
                          </button>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
