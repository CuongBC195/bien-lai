'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Save,
  X,
  Eye,
  EyeOff,
  Users,
  Calendar,
  MapPin,
  FileText,
  Loader2,
  PenLine,
  AlertCircle,
} from 'lucide-react';
import { formatVietnameseDate } from '@/lib/utils';
import SignatureModal, { SignatureResult, SignaturePoint } from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import type { ContractTemplate } from '@/data/templates';
import type { Signer, SignatureData } from '@/lib/kv';

interface DocumentEditorKVProps {
  template?: ContractTemplate;
  onSave: (data: DocumentEditorData) => void;
  onCancel: () => void;
  initialData?: DocumentEditorData;
  mode?: 'create' | 'edit';
}

export interface DocumentEditorData {
  type: 'contract' | 'receipt';
  templateId?: string;
  title: string;
  content: string;
  signers: Signer[];
  metadata: {
    contractNumber?: string;
    createdDate: string;
    effectiveDate?: string;
    expiryDate?: string;
    location: string;
  };
}

// Helper: Render signature SVG from points
function renderSignatureSVG(points: SignaturePoint[][], color?: string) {
  if (!points || points.length === 0) return null;

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of points) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(280 / width, 80 / height, 1) * 0.8;
  const offsetX = (300 - width * scale) / 2 - minX * scale;
  const offsetY = (100 - height * scale) / 2 - minY * scale;

  return points.map((stroke, i) => {
    const pathData = stroke.map((point, j) => {
      const x = point.x * scale + offsetX;
      const y = point.y * scale + offsetY;
      return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    return (
      <path
        key={i}
        d={pathData}
        stroke={color || '#000'}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });
}

export default function DocumentEditorKV({
  template,
  onSave,
  onCancel,
  initialData,
  mode = 'create',
}: DocumentEditorKVProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { toasts, showToast, removeToast } = useToast();

  // Preview mode
  const [showPreview, setShowPreview] = useState(false);

  // Document data
  const [title, setTitle] = useState(
    initialData?.title || template?.name || 'HỢP ĐỒNG'
  );
  const [content, setContent] = useState(
    initialData?.content || template?.content || ''
  );
  const [contractNumber, setContractNumber] = useState(
    initialData?.metadata.contractNumber || ''
  );
  const [createdDate, setCreatedDate] = useState(
    initialData?.metadata.createdDate || formatVietnameseDate(new Date())
  );
  const [location, setLocation] = useState(
    initialData?.metadata.location || 'TP. Cần Thơ'
  );

  // Signers
  const [signers, setSigners] = useState<Signer[]>(
    initialData?.signers ||
      template?.signers.map((s, idx) => ({
        id: `signer-${idx}`,
        role: s.role,
        name: s.defaultName || '',
        position: '',
        organization: '',
        idNumber: '',
        phone: '',
        email: '',
        address: '',
        signed: false,
      })) || [
        {
          id: 'signer-0',
          role: 'Bên A',
          name: '',
          position: '',
          organization: '',
          signed: false,
        },
        {
          id: 'signer-1',
          role: 'Bên B',
          name: '',
          position: '',
          organization: '',
          signed: false,
        },
      ]
  );

  // Signature modal
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentSignerIndex, setCurrentSignerIndex] = useState<number | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Auto-resize content editable
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = content;
    }
  }, []);

  const handleContentChange = () => {
    if (contentRef.current) {
      setContent(contentRef.current.innerHTML);
    }
  };

  const handleSignerChange = (index: number, field: keyof Signer, value: any) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const handleSignatureComplete = (result: SignatureResult) => {
    if (currentSignerIndex === null) return;

    // Convert SignatureResult to SignatureData
    const signatureData: SignatureData = {
      type: result.type,
      signaturePoints: result.type === 'draw' && result.signaturePoints ? result.signaturePoints : null,
      typedText: result.type === 'type' ? result.typedText : undefined,
      fontFamily: result.type === 'type' ? result.fontFamily : undefined,
      color: result.color,
    };

    // Update signer with signature data
    const updated = [...signers];
    updated[currentSignerIndex] = {
      ...updated[currentSignerIndex],
      signed: true,
      signedAt: Date.now(),
      signatureData: signatureData,
    };
    setSigners(updated);

    showToast(`✓ Đã ký cho ${signers[currentSignerIndex].role}`, 'success');
    setIsSignatureModalOpen(false);
    setCurrentSignerIndex(null);
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề', 'error');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') {
      showToast('Vui lòng nhập nội dung văn bản', 'error');
      return;
    }
    if (!location.trim()) {
      showToast('Vui lòng nhập địa điểm', 'error');
      return;
    }

    // Check if at least one signer has basic info
    const hasValidSigner = signers.some((s) => s.name.trim() || s.role.trim());
    if (!hasValidSigner) {
      showToast('Vui lòng nhập thông tin ít nhất một bên ký', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const data: DocumentEditorData = {
        type: 'contract',
        templateId: template?.id,
        title: title.trim(),
        content: content,
        signers: signers,
        metadata: {
          contractNumber: contractNumber.trim() || undefined,
          createdDate,
          location: location.trim(),
        },
      };

      await onSave(data);
      showToast('Lưu thành công!', 'success');
    } catch (error) {
      console.error('Save error:', error);
      showToast('Lưu thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-glass">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCancel}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {mode === 'create' ? 'Soạn Văn Bản' : 'Chỉnh Sửa Văn Bản'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {template?.name || 'Văn bản tùy chỉnh'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="text-sm font-medium">Lưu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Document Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Metadata */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Thông tin văn bản
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: HỢP ĐỒNG LAO ĐỘNG"
                    className="w-full px-4 py-2.5 glass-input rounded-xl"
                  />
                </div>

                {/* Contract Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số hợp đồng
                  </label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ví dụ: 001/HĐLĐ"
                    className="w-full px-4 py-2.5 glass-input rounded-xl"
                  />
                </div>

                {/* Date & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Ngày lập
                    </label>
                    <input
                      type="text"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="w-full px-4 py-2.5 glass-input rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Địa điểm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="TP. Cần Thơ"
                      className="w-full px-4 py-2.5 glass-input rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Content Editor */}
            <div className="glass-card rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Nội dung văn bản</h3>
                <span className="text-xs text-gray-500">
                  Hỗ trợ định dạng HTML cơ bản
                </span>
              </div>

              {/* Live Preview với Header + Content + Footer */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Header - Always visible */}
                <div className="p-6 bg-blue-50/30 border-b border-blue-100">
                  <div className="text-center text-sm leading-relaxed" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                    <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                    <p className="mt-2 text-gray-400">---------------oOo---------------</p>
                    <h1 className="text-xl font-bold mt-4">{title || 'Tiêu đề văn bản'}</h1>
                    {contractNumber && (
                      <p className="text-xs italic mt-2">Số: {contractNumber}</p>
                    )}
                  </div>
                </div>

                {/* Date & Location */}
                <div className="px-6 pt-4 text-sm" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                  <p>{createdDate}, tại {location}</p>
                </div>

                {/* Editable Content */}
                <div
                  ref={contentRef}
                  contentEditable={!showPreview}
                  onInput={handleContentChange}
                  className={`min-h-[400px] p-6 transition-all ${
                    showPreview
                      ? 'bg-white'
                      : 'focus:outline-none focus:ring-2 focus:ring-blue-300'
                  }`}
                  style={{
                    fontFamily: 'var(--font-tinos), serif',
                    fontSize: '15px',
                    lineHeight: '1.8',
                  }}
                />

                {/* Footer - Live Preview Signatures */}
                <div className="px-6 pb-6 pt-4 bg-green-50/30 border-t border-green-100">
                  <p className="text-xs text-green-700 mb-4 font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Preview chữ ký (Real-time)
                  </p>
                  
                  <div className="text-center mb-4 text-sm" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                    <p className="italic">{location}, {createdDate}</p>
                  </div>

                  <div className={`grid gap-6 ${signers.length > 2 ? 'grid-cols-2' : `grid-cols-${signers.length}`}`}>
                    {signers.map((signer, index) => (
                      <div key={signer.id} className="text-center" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                        <p className="font-bold text-sm mb-1">{signer.role}</p>
                        <p className="text-xs italic text-gray-500 mb-3">(Ký và ghi rõ họ tên)</p>
                        
                        {/* Signature Preview */}
                        <div className="min-h-[80px] flex items-center justify-center mb-3 bg-white rounded-lg border border-gray-200 p-3">
                          {signer.signed && signer.signatureData ? (
                            <>
                              {signer.signatureData.type === 'type' && signer.signatureData.typedText ? (
                                /* Typed Signature */
                                <span 
                                  className="text-2xl italic" 
                                  style={{ 
                                    fontFamily: signer.signatureData.fontFamily || 'cursive',
                                    color: signer.signatureData.color || '#000'
                                  }}
                                >
                                  {signer.signatureData.typedText}
                                </span>
                              ) : signer.signatureData.type === 'draw' && signer.signatureData.signaturePoints ? (
                                /* Drawn Signature - Show preview */
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <svg 
                                    viewBox="0 0 300 100" 
                                    className="w-full h-full"
                                    style={{ maxWidth: '200px', maxHeight: '80px' }}
                                  >
                                    {renderSignatureSVG(signer.signatureData.signaturePoints, signer.signatureData.color)}
                                  </svg>
                                </div>
                              ) : (
                                <span className="text-green-600 text-sm font-medium">✓ Đã ký</span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Chưa ký</span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="border-t border-dotted border-gray-400 pt-2 text-sm">
                          {signer.name || '...........................'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Signers */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Các bên ký ({signers.length})
              </h3>

              <div className="space-y-4">
                {signers.map((signer, index) => (
                  <div
                    key={signer.id}
                    className="p-4 bg-white border border-gray-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">
                        {signer.role}
                      </span>
                      {signer.signed ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg">
                          ✓ Đã ký
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentSignerIndex(index);
                            setIsSignatureModalOpen(true);
                          }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <PenLine className="w-3 h-3" />
                          Ký ngay
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                      placeholder="Họ và tên"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-300 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Help Text */}
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
              <p className="text-xs text-yellow-800 font-medium mb-2">💡 Lưu ý</p>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• Có thể ký trước cho admin (tùy chọn)</li>
                <li>• Hoặc gửi link cho khách hàng ký sau</li>
                <li>• Chữ ký sẽ xuất hiện trong file PDF</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onApply={handleSignatureComplete}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setCurrentSignerIndex(null);
        }}
      />
    </div>
  );
}

