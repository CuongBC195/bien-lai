'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Save, 
  FileDown,
  Mail,
  X,
  PenLine,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Link,
  Send,
  Plus,
  Trash2,
  GripVertical,
  Edit3
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import { 
  numberToVietnamese, 
  formatNumber, 
  parseFormattedNumber,
  formatVietnameseDate,
  cn 
} from '@/lib/utils';

// Dynamic field interface
interface DynamicField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'money';
}

interface ReceiptData {
  title: string;
  fields: DynamicField[];
  ngayThang: string;
  diaDiem: string;
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
}

// Legacy format for backward compatibility
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

interface Receipt {
  id: string;
  // Support both old and new format
  info?: LegacyReceiptInfo;  // Legacy format
  data?: ReceiptData;        // New format
  signatureNguoiNhan?: string;
  signatureNguoiGui?: string;
  status: 'pending' | 'signed';
  createdAt: number;
  signedAt?: number;
}

interface ReceiptEditorKVProps {
  receipt?: Receipt | null;
  onSave: () => void;
  onCancel: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

// Default fields
const DEFAULT_FIELDS: DynamicField[] = [
  { id: 'hoTenNguoiNhan', label: 'Họ và tên người nhận', value: '', type: 'text' },
  { id: 'donViNguoiNhan', label: 'Đơn vị người nhận', value: '', type: 'text' },
  { id: 'hoTenNguoiGui', label: 'Họ và tên người gửi', value: '', type: 'text' },
  { id: 'donViNguoiGui', label: 'Đơn vị người gửi', value: '', type: 'text' },
  { id: 'lyDoNop', label: 'Lý do nộp', value: '', type: 'textarea' },
  { id: 'soTien', label: 'Số tiền', value: '', type: 'money' },
];

// Convert legacy format to new format
function convertLegacyToNew(info: LegacyReceiptInfo): ReceiptData {
  return {
    title: 'GIẤY BIÊN NHẬN TIỀN',
    fields: [
      { id: 'hoTenNguoiNhan', label: 'Họ và tên người nhận', value: info.hoTenNguoiNhan || '', type: 'text' },
      { id: 'donViNguoiNhan', label: 'Đơn vị người nhận', value: info.donViNguoiNhan || '', type: 'text' },
      { id: 'hoTenNguoiGui', label: 'Họ và tên người gửi', value: info.hoTenNguoiGui || '', type: 'text' },
      { id: 'donViNguoiGui', label: 'Đơn vị người gửi', value: info.donViNguoiGui || '', type: 'text' },
      { id: 'lyDoNop', label: 'Lý do nộp', value: info.lyDoNop || '', type: 'textarea' },
      { id: 'soTien', label: 'Số tiền', value: info.soTien?.toString() || '', type: 'money' },
    ],
    ngayThang: info.ngayThang || '',
    diaDiem: info.diaDiem || 'TP. Cần Thơ',
  };
}

// Get receipt data (supports both old and new format)
function getReceiptData(receipt: Receipt | null | undefined): ReceiptData | null {
  if (!receipt) return null;
  if (receipt.data) return receipt.data;
  if (receipt.info) return convertLegacyToNew(receipt.info);
  return null;
}

export default function ReceiptEditorKV({ receipt, onSave, onCancel }: ReceiptEditorKVProps) {
  const isEditing = !!receipt;
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Get receipt data (supports both formats)
  const receiptData = getReceiptData(receipt);
  
  // Form data with dynamic fields
  const [title, setTitle] = useState(receiptData?.title || 'GIẤY BIÊN NHẬN TIỀN');
  const [fields, setFields] = useState<DynamicField[]>(
    receiptData?.fields || DEFAULT_FIELDS
  );
  const [ngayThang, setNgayThang] = useState(receiptData?.ngayThang || '');
  const [diaDiem, setDiaDiem] = useState(receiptData?.diaDiem || 'TP. Cần Thơ');
  
  // Edit mode states
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');

  // Signature states - Admin có thể ký cả 2 bên
  // Get from top-level or from data
  const [signatureNguoiNhan, setSignatureNguoiNhan] = useState<string>(
    receipt?.signatureNguoiNhan || receiptData?.signatureNguoiNhan || ''
  );
  const [signatureNguoiGui, setSignatureNguoiGui] = useState<string>(
    receipt?.signatureNguoiGui || receiptData?.signatureNguoiGui || ''
  );
  const [currentSignatureTarget, setCurrentSignatureTarget] = useState<'nguoiNhan' | 'nguoiGui'>('nguoiNhan');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Computed: bangChu from soTien field
  const soTienField = fields.find(f => f.type === 'money');
  const soTien = soTienField ? parseFormattedNumber(soTienField.value) : 0;
  const bangChu = soTien > 0 ? numberToVietnamese(soTien) : '';

  // Get name fields for signature labels
  const hoTenNguoiNhan = fields.find(f => f.id === 'hoTenNguoiNhan')?.value || '';
  const hoTenNguoiGui = fields.find(f => f.id === 'hoTenNguoiGui')?.value || '';

  // Action states
  const [saveStatus, setSaveStatus] = useState<ActionStatus>('idle');
  const [exportStatus, setExportStatus] = useState<ActionStatus>('idle');
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(receipt?.id || null);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  // Email panel
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Set date on mount
  useEffect(() => {
    if (!receipt?.info?.ngayThang) {
      const now = new Date();
      setNgayThang(formatVietnameseDate(now));
    }
  }, [receipt?.info?.ngayThang]);

  // Handle field value change
  const handleFieldChange = (id: string, value: string) => {
    setFields(prev => prev.map(f => 
      f.id === id ? { ...f, value } : f
    ));
  };

  // Handle field label change
  const handleLabelChange = (id: string, label: string) => {
    setFields(prev => prev.map(f => 
      f.id === id ? { ...f, label } : f
    ));
  };

  // Add new field
  const addField = (type: 'text' | 'textarea' = 'text') => {
    const newField: DynamicField = {
      id: `custom_${Date.now()}`,
      label: newFieldLabel || 'Trường mới',
      value: '',
      type,
    };
    setFields(prev => [...prev, newField]);
    setNewFieldLabel('');
  };

  // Remove field
  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  // Move field
  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setFields(newFields);
  };

  // Open signature modal for specific target
  const openSignatureModal = (target: 'nguoiNhan' | 'nguoiGui') => {
    setCurrentSignatureTarget(target);
    setIsSignatureModalOpen(true);
  };

  // Apply signature
  const applySignature = (sig: string) => {
    if (currentSignatureTarget === 'nguoiNhan') {
      setSignatureNguoiNhan(sig);
    } else {
      setSignatureNguoiGui(sig);
    }
  };

  // Save receipt
  const handleSave = async () => {
    setSaveStatus('loading');
    try {
      const receiptData: ReceiptData = {
        title,
        fields,
        ngayThang,
        diaDiem,
        signatureNguoiNhan,
        signatureNguoiGui,
      };

      const url = isEditing ? '/api/receipts/update' : '/api/receipts/create';
      const body = isEditing 
        ? { id: receipt.id, info: receiptData }
        : { info: receiptData };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (data.success) {
        const newId = data.receipt?.id || receipt?.id;
        setSavedReceiptId(newId);
        setSaveStatus('success');
        
        if (!isEditing) {
          setJustCreated(true);
        } else {
          setTimeout(() => {
            setSaveStatus('idle');
            onSave();
          }, 1500);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // Export PDF
  const exportPDF = useCallback(async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;

    try {
      setExportStatus('loading');
      
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (element) => {
          return element.classList?.contains('no-print');
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
      
      return pdf.output('blob');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
      return null;
    }
  }, []);

  const handleExportPDF = async () => {
    const blob = await exportPDF();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bien-nhan-${savedReceiptId || new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    if (!savedReceiptId) return;
    const url = `${window.location.origin}/?id=${savedReceiptId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowLinkCopied(true);
      setTimeout(() => setShowLinkCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowLinkCopied(true);
      setTimeout(() => setShowLinkCopied(false), 2000);
    }
  };

  // Send invitation email
  const handleSendEmail = async () => {
    if (!customerEmail) {
      showToast('Vui lòng nhập email!', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      let receiptId = savedReceiptId;
      
      // Build receiptData for save/email
      const currentReceiptData: ReceiptData = {
        title,
        fields,
        ngayThang,
        diaDiem,
        signatureNguoiNhan,
        signatureNguoiGui,
      };
      
      if (!receiptId) {
        // Create receipt first if not saved
        const createRes = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ info: currentReceiptData }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          throw new Error(createData.error);
        }
        receiptId = createData.receipt.id;
        setSavedReceiptId(receiptId);
      }

      const signUrl = `${window.location.origin}/?id=${receiptId}`;
      const receiptName = hoTenNguoiNhan || 'N/A';
      
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerEmail,
          subject: `Biên nhận tiền - ${receiptName}`,
          receiptId,
          receiptInfo: currentReceiptData,
          signUrl,
          // Pass signature status
          signatureNguoiNhan,
          signatureNguoiGui,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi email mời ký thành công!', 'success');
        setShowEmailPanel(false);
        setCustomerEmail('');
      } else {
        showToast(data.error || 'Gửi email thất bại', 'error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Có lỗi xảy ra khi gửi email!', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const getButtonContent = (status: ActionStatus, defaultText: string, Icon: React.ElementType) => {
    switch (status) {
      case 'loading':
        return (<><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</>);
      case 'success':
        return (<><CheckCircle2 className="w-4 h-4" />Thành công!</>);
      case 'error':
        return (<><AlertCircle className="w-4 h-4" />Có lỗi!</>);
      default:
        return (<><Icon className="w-4 h-4" />{defaultText}</>);
    }
  };

  // Signature status indicator
  const getSignatureStatus = () => {
    const hasNguoiNhan = !!signatureNguoiNhan;
    const hasNguoiGui = !!signatureNguoiGui;
    
    if (hasNguoiNhan && hasNguoiGui) return { text: 'Đã ký đầy đủ', color: 'text-green-600 bg-green-50' };
    if (hasNguoiNhan || hasNguoiGui) return { text: 'Đã ký một phần', color: 'text-yellow-600 bg-yellow-50' };
    return { text: 'Chưa có chữ ký', color: 'text-gray-500 bg-gray-50' };
  };

  const signatureStatus = getSignatureStatus();

  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Success - Link Created Panel */}
        {justCreated && savedReceiptId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 w-full max-w-lg shadow-xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Tạo biên lai thành công!
                </h2>
                <p className="text-gray-500">
                  Mã biên lai: <code className="bg-gray-100 px-2 py-1 rounded font-mono">{savedReceiptId}</code>
                </p>
              </div>

              {/* Signature status */}
              <div className={cn('px-4 py-2 rounded-xl mb-4 text-center text-sm font-medium', signatureStatus.color)}>
                {signatureStatus.text}
                {(!signatureNguoiNhan || !signatureNguoiGui) && (
                  <span className="block text-xs mt-1 opacity-75">
                    {!signatureNguoiNhan && !signatureNguoiGui && 'Người nhận link sẽ được yêu cầu ký cả 2 bên'}
                    {signatureNguoiNhan && !signatureNguoiGui && 'Người nhận link sẽ ký phần "Người gửi tiền"'}
                    {!signatureNguoiNhan && signatureNguoiGui && 'Người nhận link sẽ ký phần "Người nhận tiền"'}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link chia sẻ:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?id=${savedReceiptId}`}
                    className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm bg-gray-50"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      'px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2',
                      showLinkCopied ? 'bg-green-600 text-white' : 'glass-button'
                    )}
                  >
                    {showLinkCopied ? (<><Check className="w-4 h-4" />Đã copy!</>) : (<><Copy className="w-4 h-4" />Copy</>)}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailPanel(true)}
                  className="flex-1 py-2.5 glass-button-outline rounded-xl flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Gửi qua Email
                </button>
                <button
                  onClick={onSave}
                  className="flex-1 py-2.5 glass-button rounded-xl"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Panel */}
        {showEmailPanel && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Gửi email mời ký
                </h2>
                <button onClick={() => setShowEmailPanel(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email người nhận</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full glass-input rounded-xl px-4 py-2.5"
                  />
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full glass-button py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {sendingEmail ? (<><Loader2 className="w-4 h-4 animate-spin" />Đang gửi...</>) : (<><Send className="w-4 h-4" />Gửi email</>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Quay lại
          </button>

          <div className="flex flex-wrap gap-3">
            {savedReceiptId && (
              <button
                onClick={handleCopyLink}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                  showLinkCopied ? 'bg-green-100 text-green-700' : 'glass-button-outline'
                )}
              >
                {showLinkCopied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                {showLinkCopied ? 'Đã copy!' : 'Copy link'}
              </button>
            )}
            
            <button
              onClick={handleExportPDF}
              disabled={exportStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                exportStatus === 'success' ? 'bg-green-600 text-white' : exportStatus === 'error' ? 'bg-red-600 text-white' : 'glass-button-outline',
                exportStatus === 'loading' && 'opacity-75 cursor-not-allowed'
              )}
            >
              {getButtonContent(exportStatus, 'Xuất PDF', FileDown)}
            </button>
            
            <button
              onClick={handleSave}
              disabled={saveStatus === 'loading'}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'glass-button',
                saveStatus === 'loading' && 'opacity-75 cursor-not-allowed'
              )}
            >
              {getButtonContent(saveStatus, isEditing ? 'Cập nhật' : 'Lưu', Save)}
            </button>

            <button
              onClick={() => setShowEmailPanel(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium glass-button-outline"
            >
              <Mail className="w-4 h-4" />
              Gửi Email
            </button>
          </div>
        </div>

        {/* Field Management Panel */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="font-semibold text-gray-900">Quản lý trường dữ liệu</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Tên trường mới..."
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 w-40"
              />
              <button
                onClick={() => addField('text')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm
              </button>
              <button
                onClick={() => addField('textarea')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Văn bản dài
              </button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {fields.map((field, index) => (
              <div 
                key={field.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                
                {editingFieldId === field.id ? (
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleLabelChange(field.id, e.target.value)}
                    onBlur={() => setEditingFieldId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingFieldId(null)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-500"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-700">{field.label}</span>
                )}
                
                <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-200 rounded">
                  {field.type === 'money' ? 'Số tiền' : field.type === 'textarea' ? 'Văn bản dài' : 'Văn bản'}
                </span>
                
                <button
                  onClick={() => setEditingFieldId(field.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Sửa tên"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                
                {!['hoTenNguoiNhan', 'hoTenNguoiGui', 'soTien'].includes(field.id) && (
                  <button
                    onClick={() => removeField(field.id)}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      onClick={() => moveField(index, index - 1)}
                      className="p-1 text-gray-400 hover:text-gray-600 text-xs"
                      title="Di chuyển lên"
                    >
                      ↑
                    </button>
                  )}
                  {index < fields.length - 1 && (
                    <button
                      onClick={() => moveField(index, index + 1)}
                      className="p-1 text-gray-400 hover:text-gray-600 text-xs"
                      title="Di chuyển xuống"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            * Các trường "Họ và tên người nhận", "Họ và tên người gửi", "Số tiền" không thể xóa
          </p>
        </div>

        {/* Receipt Paper */}
        <div 
          ref={receiptRef}
          className="bg-white shadow-2xl mx-auto rounded-lg"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm 25mm',
            fontFamily: '"Times New Roman", Tinos, serif',
          }}
        >
          {/* Header */}
          <header className="text-center mb-8">
            <h2 className="text-base font-bold tracking-wide">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </h2>
            <p className="text-base mt-1">
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                Độc lập - Tự do - Hạnh phúc
              </span>
            </p>
            <div className="mt-8 text-gray-400">
              -----------------------
            </div>
            
            {/* Editable Title */}
            <div className="mt-6 relative group">
              {editingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                  className="text-2xl font-bold tracking-wider text-center w-full border-b-2 border-gray-300 focus:border-gray-600 outline-none bg-transparent"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-2xl font-bold tracking-wider cursor-pointer hover:bg-gray-50 py-1 rounded transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {title}
                  <Edit3 className="w-4 h-4 inline-block ml-2 opacity-0 group-hover:opacity-50 no-print" />
                </h1>
              )}
            </div>
          </header>

          {/* Body - Dynamic Fields */}
          <div className="space-y-5 text-base leading-relaxed">
            {fields.map((field) => (
              <div key={field.id} className="flex items-baseline gap-2">
                <span className="whitespace-nowrap">{field.label}:</span>
                {field.type === 'textarea' ? (
                  <textarea
                    value={field.value}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    rows={2}
                    className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent resize-none overflow-hidden"
                    placeholder="..."
                    style={{ minHeight: '2.5em' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                ) : field.type === 'money' ? (
                  <>
                    <input
                      type="text"
                      value={field.value ? formatNumber(parseFormattedNumber(field.value)) : ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                      placeholder="0"
                    />
                    <span className="whitespace-nowrap">VNĐ</span>
                  </>
                ) : (
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="flex-1 border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent"
                    placeholder="..."
                  />
                )}
              </div>
            ))}

            {/* Bang chu - auto generated */}
            {soTien > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="whitespace-nowrap">Bằng chữ:</span>
                <span className="flex-1 border-b border-dotted border-gray-400 px-2 py-1 italic text-gray-700">
                  {bangChu}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-16">
            <div className="flex items-baseline gap-2 justify-end italic mb-10">
              <input
                type="text"
                value={diaDiem}
                onChange={(e) => setDiaDiem(e.target.value)}
                className="border-b border-dotted border-gray-400 focus:border-gray-900 outline-none px-2 py-1 bg-transparent text-right"
                placeholder="Địa điểm"
              />
              <span>, {ngayThang}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center">
              {/* Người gửi tiền */}
              <div>
                <p className="font-bold mb-2">Người gửi tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiGui ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiGui} 
                        alt="Chữ ký người gửi" 
                        className="h-16 w-auto object-contain"
                        style={{ imageRendering: 'auto', minWidth: '80px' }}
                      />
                      <button
                        onClick={() => setSignatureNguoiGui('')}
                        className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openSignatureModal('nguoiGui')}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 hover:border-gray-600 hover:bg-gray-50 transition-colors no-print font-medium"
                    >
                      <PenLine className="w-5 h-5" />
                      Ký tại đây
                    </button>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {hoTenNguoiGui || '...........................'}
                </p>
              </div>

              {/* Người nhận tiền */}
              <div>
                <p className="font-bold mb-2">Người nhận tiền</p>
                <p className="text-sm text-gray-500 italic mb-4">(Ký và ghi rõ họ tên)</p>
                
                <div className="min-h-[100px] flex flex-col items-center justify-center">
                  {signatureNguoiNhan ? (
                    <div className="relative group">
                      <img 
                        src={signatureNguoiNhan} 
                        alt="Chữ ký người nhận" 
                        className="h-16 w-auto object-contain"
                        style={{ imageRendering: 'auto', minWidth: '80px' }}
                      />
                      <button
                        onClick={() => setSignatureNguoiNhan('')}
                        className="absolute -top-2 -right-2 p-1 bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity no-print"
                        title="Xóa chữ ký"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openSignatureModal('nguoiNhan')}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 hover:border-gray-600 hover:bg-gray-50 transition-colors no-print font-medium"
                    >
                      <PenLine className="w-5 h-5" />
                      Ký tại đây
                    </button>
                  )}
                </div>

                <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8 mt-2">
                  {hoTenNguoiNhan || '...........................'}
                </p>
              </div>
            </div>
          </footer>
        </div>

        {/* Signature Status Info */}
        <div className="text-center mt-4">
          <span className={cn('text-sm px-4 py-2 rounded-xl inline-block font-medium', signatureStatus.color)}>
            {signatureStatus.text}
          </span>
        </div>

        <p className="text-center text-gray-500 text-sm mt-2">
          * Admin có thể ký bất kỳ bên nào. Khi share link, người nhận sẽ được yêu cầu ký phần còn thiếu.
        </p>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApply={applySignature}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
