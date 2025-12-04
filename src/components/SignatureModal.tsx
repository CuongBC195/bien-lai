'use client';

import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, PenTool, Type, Eraser, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Signature point interface for server-side rendering
export interface SignaturePoint {
  x: number;
  y: number;
  time: number;
  color?: string;
}

// Result type for signature - includes both preview and data for storage
export interface SignatureResult {
  // Base64 for local preview only (not stored in DB)
  previewDataUrl: string;
  // Points array for server-side rendering (stored in DB)
  signaturePoints: SignaturePoint[][] | null;
  // Type of signature
  type: 'draw' | 'type';
  // For typed signatures
  typedText?: string;
  fontFamily?: string;
  color?: string;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: SignatureResult) => void;
}

export interface SignatureModalRef {
  open: () => void;
  close: () => void;
}

type TabType = 'draw' | 'type';

const handwritingFonts = [
  { name: 'Dancing Script', style: 'cursive' },
  { name: 'Pacifico', style: 'cursive' },
  { name: 'Great Vibes', style: 'cursive' },
  { name: 'Allura', style: 'cursive' },
];

const SignatureModal = forwardRef<SignatureModalRef, SignatureModalProps>(
  ({ isOpen, onClose, onApply }, ref) => {
    const signatureRef = useRef<SignatureCanvas>(null);
    const [activeTab, setActiveTab] = useState<TabType>('draw');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [typedName, setTypedName] = useState('');
    const [selectedFont, setSelectedFont] = useState(handwritingFonts[0].name);
    const [penColor, setPenColor] = useState('#000000');

    useImperativeHandle(ref, () => ({
      open: () => {},
      close: () => onClose(),
    }));

    const clearSignature = () => {
      if (signatureRef.current) {
        signatureRef.current.clear();
      }
    };

    const generateTypedSignature = (): string => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = penColor;
        ctx.font = `36px "${selectedFont}", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
      }
      
      return canvas.toDataURL('image/jpeg', 0.6);
    };

    const compressSignatureAsync = (dataUrl: string): Promise<string> => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const img = new Image();
        
        img.onload = () => {
          const maxWidth = 300;
          const maxHeight = 100;
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    };

    const handleApply = async () => {
      setErrorMessage(null);
      let result: SignatureResult;
      
      if (activeTab === 'draw' && signatureRef.current) {
        if (signatureRef.current.isEmpty()) {
          setErrorMessage('Vui lòng ký tên trước khi áp dụng!');
          return;
        }
        
        // Get points data for server-side rendering
        // toData() returns Point[][] (array of strokes, each stroke is array of points)
        const rawPoints = signatureRef.current.toData();
        const signaturePoints: SignaturePoint[][] = rawPoints.map(stroke => 
          stroke.map(point => ({
            x: point.x,
            y: point.y,
            time: point.time || Date.now(),
            color: penColor
          }))
        );
        
        // Get preview image for local display
        const original = signatureRef.current.toDataURL('image/png');
        const previewDataUrl = await compressSignatureAsync(original);
        
        result = {
          previewDataUrl,
          signaturePoints,
          type: 'draw',
          color: penColor
        };
      } else if (activeTab === 'type') {
        if (!typedName.trim()) {
          setErrorMessage('Vui lòng nhập tên trước khi áp dụng!');
          return;
        }
        
        // For typed signatures, we store the text and font, server generates image
        const previewDataUrl = generateTypedSignature();
        
        result = {
          previewDataUrl,
          signaturePoints: null, // No points for typed
          type: 'type',
          typedText: typedName.trim(),
          fontFamily: selectedFont,
          color: penColor
        };
      } else {
        return;
      }
      
      onApply(result);
      onClose();
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal Content */}
        <div className="relative glass-card rounded-2xl w-full max-w-lg mx-2 sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/50">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Ký xác nhận</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200/50">
            <button
              onClick={() => { setActiveTab('draw'); setErrorMessage(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 font-medium transition-colors text-sm sm:text-base',
                activeTab === 'draw'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              )}
            >
              <PenTool className="w-4 h-4" />
              Ký tay
            </button>
            <button
              onClick={() => { setActiveTab('type'); setErrorMessage(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 font-medium transition-colors text-sm sm:text-base',
                activeTab === 'type'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              )}
            >
              <Type className="w-4 h-4" />
              Nhập tên
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {activeTab === 'draw' && (
              <div className="space-y-3 sm:space-y-4">
                {/* Color picker */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Màu mực:</span>
                  <div className="flex gap-2">
                    {['#000000', '#1e3a8a', '#991b1b'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          penColor === color ? 'scale-110 ring-2 ring-gray-300 ring-offset-2' : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Signature Canvas */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={signatureRef}
                    penColor={penColor}
                    canvasProps={{
                      className: 'signature-canvas w-full',
                      style: { width: '100%', height: '150px', touchAction: 'none' }
                    }}
                    backgroundColor="white"
                  />
                </div>

                {/* Clear button */}
                <button
                  onClick={clearSignature}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  Xóa chữ ký
                </button>
              </div>
            )}

            {activeTab === 'type' && (
              <div className="space-y-4">
                {/* Font selector */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Chọn kiểu chữ:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {handwritingFonts.map((font) => (
                      <button
                        key={font.name}
                        onClick={() => setSelectedFont(font.name)}
                        className={cn(
                          'py-2 px-3 text-lg rounded-xl border transition-all',
                          selectedFont === font.name
                            ? 'border-gray-900 bg-gray-50 text-gray-900'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        style={{ fontFamily: `"${font.name}", ${font.style}` }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name input */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Nhập tên của bạn:</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-4 py-3 glass-input rounded-xl"
                  />
                </div>

                {/* Preview */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-white min-h-[120px] flex items-center justify-center">
                  {typedName ? (
                    <span
                      className="text-4xl"
                      style={{ fontFamily: `"${selectedFont}", cursive`, color: penColor }}
                    >
                      {typedName}
                    </span>
                  ) : (
                    <span className="text-gray-400">Xem trước chữ ký</span>
                  )}
                </div>

                {/* Color picker for typed */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Màu chữ:</span>
                  <div className="flex gap-2">
                    {['#000000', '#1e3a8a', '#991b1b'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          penColor === color ? 'scale-110 ring-2 ring-gray-300 ring-offset-2' : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/50 border-t border-gray-200/50">
            <button
              onClick={onClose}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-gray-700 glass-button-outline rounded-xl font-medium text-sm sm:text-base"
            >
              Hủy
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 glass-button rounded-xl font-medium text-sm sm:text-base"
            >
              <Check className="w-4 h-4" />
              Áp dụng
            </button>
          </div>
        </div>

        {/* Google Fonts for handwriting */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Allura&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&display=swap');
        `}</style>
      </div>
    );
  }
);

SignatureModal.displayName = 'SignatureModal';

export default SignatureModal;
