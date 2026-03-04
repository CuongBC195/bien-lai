'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FileDown,
  PenLine,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import SignatureModal, { SignatureResult } from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import type {
  Receipt, Signer, SignatureData
} from '@/lib/kv';

/**
 * Client-side function to convert SignatureData to base64 data URL
 * This allows displaying signatures that were saved on server
 */
function signatureDataToDataUrl(signatureData: SignatureData | undefined, width = 200, height = 80): string | null {
  if (!signatureData) return null;

  if (signatureData.type === 'type' && signatureData.typedText) {
    // Typed signature - create SVG with text
    const fontFamily = signatureData.fontFamily || 'Dancing Script, cursive';
    const color = signatureData.color || '#000000';
    const escapedText = signatureData.typedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${color}" font-size="28" font-family="${fontFamily}">
        ${escapedText}
      </text>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  if (signatureData.type === 'draw' && signatureData.signaturePoints && signatureData.signaturePoints.length > 0) {
    // Drawn signature - convert points to SVG paths
    const points = signatureData.signaturePoints;

    // Filter out empty strokes
    const validStrokes = points.filter(stroke => stroke && stroke.length > 0);
    if (validStrokes.length === 0) return null;

    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of validStrokes) {
      for (const point of stroke) {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;

    const originalWidth = maxX - minX;
    const originalHeight = maxY - minY;

    if (originalWidth === 0 && originalHeight === 0) {
      // Single point
      const color = signatureData.color || '#000000';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="2" fill="${color}" />
      </svg>`;
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }

    const padding = 10;
    const scaleX = (width - padding * 2) / (originalWidth || 1);
    const scaleY = (height - padding * 2) / (originalHeight || 1);
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    const offsetX = (width - scaledWidth) / 2 - minX * scale;
    const offsetY = (height - scaledHeight) / 2 - minY * scale;

    const paths = validStrokes.map((stroke) => {
      const pathData = stroke
        .filter(point => point && isFinite(point.x) && isFinite(point.y))
        .map((point, j) => {
          const x = point.x * scale + offsetX;
          const y = point.y * scale + offsetY;
          return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

      if (!pathData) return '';

      const color = signatureData.color || '#000000';
      return `<path d="${pathData}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).filter(p => p).join('\n');

    if (!paths) return null;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      ${paths}
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  return null;
}

interface ContractViewKVProps {
  receiptId: string;
}

export default function ContractViewKV({ receiptId }: ContractViewKVProps) {
  const contractRef = useRef<HTMLDivElement>(null);
  const { toasts, showToast, removeToast } = useToast();

  // Contract data
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentSignerId, setCurrentSignerId] = useState<string | null>(null);
  const [localSignatures, setLocalSignatures] = useState<Record<string, string>>({});
  const [signatureDataMap, setSignatureDataMap] = useState<Record<string, SignatureData>>({});

  // Action states
  const [signing, setSigning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // PDF upload rendering state
  const [isPdfUpload, setIsPdfUpload] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const pdfCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pdfPlacements, setPdfPlacements] = useState<any[]>([]);
  const [pdfPagesRendered, setPdfPagesRendered] = useState(false);

  // Fetch contract
  useEffect(() => {
    const fetchContract = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        const data = await res.json();

        if (data.success && data.receipt) {
          const r = data.receipt as Receipt;

          if (!r.document) {
            setError('Đây không phải hợp đồng mới. Vui lòng dùng trang xem biên lai cũ.');
            return;
          }

          setReceipt(r);

          // Check if already fully signed
          if (r.status === 'signed') {
            setCompleted(true);
          }

          // Track view (customer opened the link)
          try {
            await fetch('/api/receipts/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: receiptId }),
            });
          } catch (error) {
            console.error('Error tracking view:', error);
            // Don't fail if tracking fails
          }
        } else {
          setError(data.error || 'Không tìm thấy hợp đồng');
        }
      } catch (err) {
        console.error('Error fetching contract:', err);
        setError('Có lỗi xảy ra khi tải hợp đồng');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [receiptId]);

  // Load PDF document and render pages
  const pdfDocRef = useRef<any>(null);
  const pdfBase64Ref = useRef<string | null>(null);

  useEffect(() => {
    if (!receipt?.document?.metadata?.isPdfUpload) return;

    setIsPdfUpload(true);
    setPdfPlacements(receipt.document.metadata.signaturePlacements || []);

    let cancelled = false;

    const loadAndRender = async () => {
      try {
        setPdfRendering(true);

        // Fetch PDF data from separate API endpoint (avoids 1MB Redis key limit)
        let pdfBase64: string | null = null;
        try {
          const pdfRes = await fetch(`/api/receipts/get-pdf?id=${receiptId}`);
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.pdfBase64) {
            pdfBase64 = pdfData.pdfBase64;
          }
        } catch (e) {
          console.warn('Failed to fetch PDF from API, trying metadata fallback');
        }

        // Fallback: try reading from metadata (legacy documents)
        if (!pdfBase64 && receipt.document?.metadata?.pdfBase64) {
          pdfBase64 = receipt.document.metadata.pdfBase64 as string;
        }

        if (!pdfBase64 || cancelled) {
          console.error('No PDF data available');
          setPdfRendering(false);
          return;
        }

        pdfBase64Ref.current = pdfBase64;

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const base64Data = pdfBase64.split(',')[1] || pdfBase64;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setPdfTotalPages(doc.numPages);

        // Wait for canvases to mount (retry up to 20 times, 200ms apart)
        const tryRender = async (attempt = 0): Promise<void> => {
          if (cancelled) return;

          const canvasElements: HTMLCanvasElement[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const el = pdfCanvasRefs.current.get(i);
            if (el) canvasElements.push(el);
          }

          if (canvasElements.length < doc.numPages && attempt < 20) {
            await new Promise(r => setTimeout(r, 200));
            return tryRender(attempt + 1);
          }

          // Render all pages
          for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            if (cancelled) return;
            const canvas = pdfCanvasRefs.current.get(pageNum);
            if (!canvas) continue;

            const page = await doc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.3 });
            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas,
            } as any).promise;
          }

          if (!cancelled) {
            setPdfPagesRendered(true);
            setPdfRendering(false);
          }
        };

        await tryRender();
      } catch (error) {
        console.error('Error loading/rendering PDF:', error);
        setPdfRendering(false);
      }
    };

    loadAndRender();

    return () => { cancelled = true; };
  }, [receipt]);

  // Canvas ref callback — just stores the ref
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null, pageNum: number) => {
    if (el) {
      pdfCanvasRefs.current.set(pageNum, el);
    }
  }, []);

  // Handle signature
  const handleOpenSignature = (signerId: string) => {
    setCurrentSignerId(signerId);
    setIsSignatureModalOpen(true);
  };

  const handleSignatureComplete = (result: SignatureResult) => {
    if (!currentSignerId) return;

    // 🔒 VALIDATION: Check if signature is actually drawn/typed
    if (result.type === 'draw') {
      if (!result.signaturePoints || result.signaturePoints.length === 0) {
        showToast('⚠️ Vui lòng vẽ chữ ký trước khi lưu!', 'error');
        return;
      }
      // Check if all strokes are empty
      const hasValidStrokes = result.signaturePoints.some(stroke => stroke.length > 0);
      if (!hasValidStrokes) {
        showToast('⚠️ Chữ ký không hợp lệ. Vui lòng vẽ lại!', 'error');
        return;
      }
    } else if (result.type === 'type') {
      if (!result.typedText || result.typedText.trim() === '') {
        showToast('⚠️ Vui lòng nhập tên trước khi lưu!', 'error');
        return;
      }
    }

    // Store local preview
    setLocalSignatures(prev => ({
      ...prev,
      [currentSignerId]: result.previewDataUrl,
    }));

    // Store signature data for server submission
    const signatureData: SignatureData = {
      type: result.type,
      signaturePoints: result.type === 'draw' && result.signaturePoints ? result.signaturePoints : null,
      typedText: result.type === 'type' ? result.typedText : undefined,
      fontFamily: result.type === 'type' ? result.fontFamily : undefined,
      color: result.color,
    };

    setSignatureDataMap(prev => ({
      ...prev,
      [currentSignerId]: signatureData,
    }));

    setIsSignatureModalOpen(false);
    setCurrentSignerId(null);
    showToast('✓ Đã thêm chữ ký', 'success');
  };

  // Submit all signatures
  const handleSubmitSignatures = async () => {
    if (!receipt?.document) return;

    // Check if all required signers have signed
    const unsignedSigners = receipt.document.signers.filter(
      s => !s.signed && !localSignatures[s.id]
    );

    if (unsignedSigners.length > 0) {
      showToast(`Còn ${unsignedSigners.length} bên chưa ký`, 'error');
      return;
    }

    setSigning(true);

    try {
      // Find the first unsigned signer who has signature data
      const signerToSign = receipt.document.signers.find(s => !s.signed && signatureDataMap[s.id]);

      if (!signerToSign) {
        showToast('Không tìm thấy chữ ký để gửi', 'error');
        return;
      }

      // Get the actual signature data
      const signatureData = signatureDataMap[signerToSign.id];

      // 🔒 FINAL VALIDATION: Double-check signature data before sending
      if (!signatureData) {
        showToast('⚠️ Không tìm thấy dữ liệu chữ ký!', 'error');
        setSigning(false);
        return;
      }

      if (signatureData.type === 'draw') {
        if (!signatureData.signaturePoints || signatureData.signaturePoints.length === 0) {
          showToast('⚠️ Chữ ký không hợp lệ. Vui lòng ký lại!', 'error');
          // Remove invalid signature
          setSignatureDataMap(prev => {
            const newMap = { ...prev };
            delete newMap[signerToSign.id];
            return newMap;
          });
          setLocalSignatures(prev => {
            const newSigs = { ...prev };
            delete newSigs[signerToSign.id];
            return newSigs;
          });
          setSigning(false);
          return;
        }
      } else if (signatureData.type === 'type') {
        if (!signatureData.typedText || signatureData.typedText.trim() === '') {
          showToast('⚠️ Chữ ký không hợp lệ. Vui lòng nhập tên lại!', 'error');
          setSigning(false);
          return;
        }
      }

      const response = await fetch('/api/receipts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: receiptId,
          signerId: signerToSign.id,
          signatureDataNguoiGui: signatureData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('Ký thành công!', 'success');
        setCompleted(true);

        // Reload contract
        const refreshRes = await fetch(`/api/receipts/get?id=${receiptId}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setReceipt(refreshData.receipt);
        }
      } else {
        // 🔒 SECURITY: Handle specific error codes
        if (result.code === 'ALREADY_SIGNED') {
          showToast('⚠️ Tài liệu này đã được ký rồi!', 'error');
          setCompleted(true);
          // Reload to show updated state
          window.location.reload();
        } else if (result.code === 'PDF_GENERATION_FAILED') {
          showToast('❌ Không thể tạo PDF. Vui lòng thử lại sau.', 'error');
        } else if (result.code === 'EMPTY_SIGNATURE') {
          showToast('⚠️ Vui lòng vẽ hoặc gõ chữ ký trước khi gửi!', 'error');
        } else if (result.code === 'RATE_LIMITED') {
          const retryAfter = result.retryAfter || 60;
          showToast(`⏱️ Vui lòng đợi ${retryAfter} giây trước khi thử lại.`, 'error');
          // Auto re-enable after rate limit expires
          setTimeout(() => {
            setSigning(false);
          }, retryAfter * 1000);
          return; // Don't setSigning(false) immediately
        } else {
          showToast(result.error || 'Ký thất bại', 'error');
        }
      }
    } catch (error) {
      console.error('Error signing:', error);
      showToast('Có lỗi xảy ra khi ký', 'error');
    } finally {
      // Only reset if not rate limited (handled above)
      setSigning(false);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!receipt?.document) return;

    setExporting(true);

    try {
      // For PDF uploads: embed signatures into PDF using pdf-lib, then download
      if (isPdfUpload) {
        // Use cached PDF data from ref, or fetch from API
        let pdfBase64 = pdfBase64Ref.current;
        if (!pdfBase64) {
          try {
            const pdfRes = await fetch(`/api/receipts/get-pdf?id=${receiptId}`);
            const pdfData = await pdfRes.json();
            if (pdfData.success) pdfBase64 = pdfData.pdfBase64;
          } catch { }
        }
        // Legacy fallback
        if (!pdfBase64 && receipt.document.metadata?.pdfBase64) {
          pdfBase64 = receipt.document.metadata.pdfBase64 as string;
        }
        if (!pdfBase64) {
          showToast('Không tìm thấy dữ liệu PDF', 'error');
          setExporting(false);
          return;
        }
        const placements = (receipt.document.metadata.signaturePlacements || []) as any[];

        // Dynamically import pdf-lib
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

        // Decode original PDF
        const base64Data = pdfBase64.split(',')[1] || pdfBase64;
        const binaryString = atob(base64Data);
        const pdfBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i);
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const contract = receipt.document;

        // Embed signatures at placements
        for (const placement of placements) {
          const signer = contract.signers[placement.signerIndex];
          if (!signer || !signer.signed || !signer.signatureData) continue;
          if (placement.page >= pages.length) continue;

          const page = pages[placement.page];
          const { width: pageWidth, height: pageHeight } = page.getSize();

          const x = (placement.x / 100) * pageWidth;
          const boxWidth = (placement.width / 100) * pageWidth;
          const boxHeight = (placement.height / 100) * pageHeight;
          const y = pageHeight - (placement.y / 100) * pageHeight - boxHeight;

          if (signer.signatureData.type === 'type' && signer.signatureData.typedText) {
            const text = signer.signatureData.typedText;
            const fontSize = Math.min(boxHeight * 0.6, 18);
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textX = x + (boxWidth - textWidth) / 2;
            const textY = y + (boxHeight - fontSize) / 2;

            const hexColor = (signer.signatureData.color || '#000000').replace('#', '');
            const r = parseInt(hexColor.substring(0, 2), 16) / 255;
            const g = parseInt(hexColor.substring(2, 4), 16) / 255;
            const b = parseInt(hexColor.substring(4, 6), 16) / 255;

            page.drawText(text, {
              x: textX,
              y: textY,
              size: fontSize,
              font,
              color: rgb(r, g, b),
            });
          } else if (signer.signatureData.type === 'draw' && signer.signatureData.signaturePoints) {
            const points = signer.signatureData.signaturePoints;
            const validStrokes = points.filter((s: any) => s && s.length > 0);
            if (validStrokes.length === 0) continue;

            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (const stroke of validStrokes) {
              for (const p of stroke) {
                if (!p || typeof p.x !== 'number') continue;
                sMinX = Math.min(sMinX, p.x);
                sMinY = Math.min(sMinY, p.y);
                sMaxX = Math.max(sMaxX, p.x);
                sMaxY = Math.max(sMaxY, p.y);
              }
            }
            if (!isFinite(sMinX)) continue;

            const sigWidth = sMaxX - sMinX || 1;
            const sigHeight = sMaxY - sMinY || 1;
            const pad = 4;
            const scaleX = (boxWidth - pad * 2) / sigWidth;
            const scaleY = (boxHeight - pad * 2) / sigHeight;
            const scale = Math.min(scaleX, scaleY);
            const scaledW = sigWidth * scale;
            const scaledH = sigHeight * scale;
            const offsetX = x + (boxWidth - scaledW) / 2;
            const offsetY = y + (boxHeight - scaledH) / 2;

            const hexColor = (signer.signatureData.color || '#000000').replace('#', '');
            const r = parseInt(hexColor.substring(0, 2), 16) / 255;
            const g = parseInt(hexColor.substring(2, 4), 16) / 255;
            const b = parseInt(hexColor.substring(4, 6), 16) / 255;

            for (const stroke of validStrokes) {
              for (let j = 1; j < stroke.length; j++) {
                const p1 = stroke[j - 1];
                const p2 = stroke[j];
                if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p2.x)) continue;

                const x1 = (p1.x - sMinX) * scale + offsetX;
                const y1 = offsetY + scaledH - (p1.y - sMinY) * scale;
                const x2 = (p2.x - sMinX) * scale + offsetX;
                const y2 = offsetY + scaledH - (p2.y - sMinY) * scale;

                page.drawLine({
                  start: { x: x1, y: y1 },
                  end: { x: x2, y: y2 },
                  thickness: 1.5,
                  color: rgb(r, g, b),
                });
              }
            }
          }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${receipt.document.title || 'Hop_Dong'}_${receiptId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Đã tải xuống PDF có chữ ký', 'success');
        setExporting(false);
        return;
      }

      // For regular contracts: capture HTML as image
      if (!contractRef.current) return;

      const dataUrl = await toPng(contractRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = img.width / img.height;
      const pageRatio = pageWidth / pageHeight;

      let finalWidth, finalHeight;
      if (imgRatio > pageRatio) {
        finalWidth = pageWidth;
        finalHeight = pageWidth / imgRatio;
      } else {
        finalHeight = pageHeight;
        finalWidth = pageHeight * imgRatio;
      }

      pdf.addImage(dataUrl, 'PNG', 0, 0, finalWidth, finalHeight);
      pdf.save(`Hop_Dong_${receiptId}.pdf`);

      showToast('Đã tải xuống PDF', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showToast('Không thể xuất PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
          <span className="text-gray-500">Đang tải hợp đồng...</span>
        </div>
      </div>
    );
  }

  // Error
  if (error || !receipt?.document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Không tìm thấy hợp đồng</h2>
          <p className="text-gray-500">{error || 'Hợp đồng không tồn tại'}</p>
        </div>
      </div>
    );
  }

  const contract = receipt.document;

  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="max-w-4xl mx-auto">
        {/* Success Banner */}
        {completed && (
          <div className="glass-card rounded-2xl p-6 mb-6 text-center border-2 border-green-400">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-green-900 mb-2">
              ✅ Hợp đồng đã hoàn tất!
            </h3>
            <p className="text-green-700">
              Tất cả các bên đã ký xác nhận. Bạn có thể tải xuống file PDF.
            </p>
          </div>
        )}

        {/* Contract Content */}
        <div ref={contractRef} className="glass-card rounded-2xl p-8 mb-6" style={{ fontFamily: 'var(--font-tinos), serif' }}>
          {isPdfUpload ? (
            /* ===== PDF UPLOAD VIEW: Show all PDF pages with signature overlays ===== */
            <div>

              {pdfRendering && !pdfPagesRendered && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  <span className="ml-3 text-gray-500">Đang tải PDF...</span>
                </div>
              )}

              {/* All PDF pages */}
              <div className="space-y-6">
                {Array.from({ length: pdfTotalPages }, (_, i) => i).map((pageIndex) => (
                  <div key={pageIndex} className="flex justify-center">
                    <div className="relative inline-block shadow-lg">
                      {/* Page label */}
                      <div className="absolute -top-6 left-0 text-xs text-gray-400">
                        Trang {pageIndex + 1} / {pdfTotalPages}
                      </div>

                      <canvas
                        ref={(el) => setCanvasRef(el, pageIndex + 1)}
                        className="block rounded-lg"
                      />

                      {/* Signature placement overlays for this page */}
                      {pdfPlacements
                        .filter((p: any) => p.page === pageIndex)
                        .map((placement: any) => {
                          const signer = contract.signers[placement.signerIndex];
                          if (!signer) return null;

                          const hasLocalSignature = !!localSignatures[signer.id];
                          const hasServerSignature = signer.signed && signer.signatureData;
                          const hasSignature = hasLocalSignature || hasServerSignature;
                          const signaturePreview = localSignatures[signer.id] || signatureDataToDataUrl(signer.signatureData);

                          return (
                            <div
                              key={placement.id}
                              className="absolute"
                              style={{
                                left: `${placement.x}%`,
                                top: `${placement.y}%`,
                                width: `${placement.width}%`,
                                height: `${placement.height}%`,
                                border: hasSignature ? 'none' : '2px dashed #3b82f6',
                                backgroundColor: hasSignature ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                borderRadius: '4px',
                              }}
                            >
                              <div className="w-full h-full flex flex-col items-center justify-center">
                                {hasSignature && signaturePreview ? (
                                  <img
                                    src={signaturePreview}
                                    alt={`Chữ ký ${signer.role}`}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                ) : !completed && !signer.signed ? (
                                  <button
                                    onClick={() => handleOpenSignature(signer.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] border border-dashed border-blue-400 rounded text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    <PenLine className="w-3 h-3" />
                                    Ký ({signer.role})
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-400 italic">
                                    {signer.signed ? '✓' : signer.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ===== REGULAR CONTRACT VIEW ===== */
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                <p className="mt-4 text-gray-400">---------------oOo---------------</p>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-center mb-2">{contract.title}</h1>
              {contract.metadata.contractNumber && (
                <p className="text-center text-sm italic mb-6">Số: {contract.metadata.contractNumber}</p>
              )}

              {/* Date & Location */}
              <p className="mb-8">
                {contract.metadata.createdDate}, tại {contract.metadata.location}
              </p>

              {/* Content */}
              <div
                className="mb-8 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contract.content }}
              />

              {/* Signatures */}
              <div className="mt-12">
                <p className="text-center mb-8">
                  {contract.metadata.location}, {contract.metadata.createdDate}
                </p>

                <div className={`grid gap-8 ${contract.signers.length > 2 ? 'grid-cols-2' : `grid-cols-${contract.signers.length}`}`}>
                  {contract.signers.map((signer) => {
                    const hasLocalSignature = !!localSignatures[signer.id];
                    const hasServerSignature = signer.signed && signer.signatureData;
                    const hasSignature = hasLocalSignature || hasServerSignature;
                    const signaturePreview = localSignatures[signer.id] || signatureDataToDataUrl(signer.signatureData);

                    return (
                      <div key={signer.id} className="text-center">
                        <p className="font-bold mb-2">{signer.role}</p>
                        <p className="text-sm italic text-gray-500 mb-4">(Ký và ghi rõ họ tên)</p>

                        <div className="min-h-[100px] flex items-center justify-center mb-4">
                          {hasSignature && signaturePreview ? (
                            <img
                              src={signaturePreview}
                              alt={`Chữ ký ${signer.role}`}
                              className="h-20 w-auto object-contain"
                            />
                          ) : !completed && !signer.signed ? (
                            <button
                              onClick={() => handleOpenSignature(signer.id)}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-blue-400 rounded-xl text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <PenLine className="w-4 h-4" />
                              Ký xác nhận
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">
                              {signer.signed ? '✓ Đã ký' : 'Chưa ký'}
                            </span>
                          )}
                        </div>

                        <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8">
                          {signer.name || '...........................'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-3">
            {!completed && (
              <button
                onClick={handleSubmitSignatures}
                disabled={signing || Object.keys(localSignatures).length === 0}
                className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {signing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Hoàn tất & Gửi
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleExportPDF}
              disabled={exporting || !completed}
              className="w-full px-6 py-3 border-2 border-black text-black rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xuất...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  Tải xuống PDF
                </>
              )}
            </button>
          </div>

          {!completed && (
            <p className="text-xs text-gray-500 text-center mt-3">
              {Object.keys(localSignatures).length > 0
                ? 'Nhấn "Hoàn tất & Gửi" để lưu chữ ký'
                : 'Vui lòng ký xác nhận trước'}
            </p>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setCurrentSignerId(null);
        }}
        onApply={handleSignatureComplete}
      />
    </div>
  );
}

