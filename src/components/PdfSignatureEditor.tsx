'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Upload,
    FileText,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Trash2,
    Save,
    X,
    PenLine,
    Users,
    Loader2,
    Move,
    Plus,
    Minus,
    GripVertical,
    MousePointer2,
} from 'lucide-react';
import SignatureModal, { SignatureResult, SignaturePoint } from './SignatureModal';
import { useToast, ToastContainer } from './Toast';
import type { Signer, SignatureData } from '@/lib/kv';

// ---- Types ----

export interface SignaturePlacement {
    id: string;
    signerIndex: number;
    page: number;
    x: number; // % position
    y: number;
    width: number; // % size
    height: number;
}

export interface PdfSignatureData {
    title: string;
    pdfBase64: string;
    signers: Signer[];
    placements: SignaturePlacement[];
    metadata: {
        createdDate: string;
        location: string;
    };
}

interface PdfSignatureEditorProps {
    onSave: (data: PdfSignatureData) => void;
    onCancel: () => void;
}

// Helper: Render signature SVG from points
function renderSignatureSVG(points: SignaturePoint[][], color?: string) {
    if (!points || points.length === 0) return null;
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
    const scale = Math.min(180 / width, 50 / height, 1) * 0.8;
    const offsetX = (200 - width * scale) / 2 - minX * scale;
    const offsetY = (60 - height * scale) / 2 - minY * scale;

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
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    });
}

// ---- Component ----

export default function PdfSignatureEditor({ onSave, onCancel }: PdfSignatureEditorProps) {
    const { toasts, showToast, removeToast } = useToast();

    // PDF state
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfBase64, setPdfBase64] = useState<string>('');
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [isRendering, setIsRendering] = useState(false);

    // Canvas refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Document info
    const [title, setTitle] = useState('');

    // Signers
    const [signers, setSigners] = useState<Signer[]>([
        { id: 'signer-0', role: 'Bên A', name: '', signed: false },
        { id: 'signer-1', role: 'Bên B', name: '', signed: false },
    ]);

    // Signature placements
    const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
    const [activePlacementId, setActivePlacementId] = useState<string | null>(null);

    // Placement mode
    const [placementMode, setPlacementMode] = useState<number | null>(null); // signerIndex when placing

    // Signature modal
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [currentSignerIndex, setCurrentSignerIndex] = useState<number | null>(null);

    // Dragging
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Saving
    const [isSaving, setIsSaving] = useState(false);

    // Upload state
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ---- PDF Loading ----

    const loadPdf = useCallback(async (file: File) => {
        try {
            setIsRendering(true);

            // Read file as base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
            const base64 = await base64Promise;
            setPdfBase64(base64);

            // Load PDF with pdfjs
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

            const arrayBuffer = await file.arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setCurrentPage(1);
            setPdfFile(file);
            setTitle(file.name.replace(/\.pdf$/i, ''));

            showToast(`Đã tải PDF: ${doc.numPages} trang`, 'success');
        } catch (error) {
            console.error('Error loading PDF:', error);
            showToast('Không thể đọc file PDF. Vui lòng thử lại.', 'error');
        } finally {
            setIsRendering(false);
        }
    }, [showToast]);

    // ---- Render PDF Page ----

    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return;

        setIsRendering(true);
        try {
            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;
        } catch (error) {
            console.error('Error rendering page:', error);
        } finally {
            setIsRendering(false);
        }
    }, [pdfDoc, currentPage, scale]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    // ---- File handling ----

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast('Vui lòng chọn file PDF', 'error');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast('File quá lớn. Tối đa 10MB', 'error');
                return;
            }
            loadPdf(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast('Vui lòng chọn file PDF', 'error');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast('File quá lớn. Tối đa 10MB', 'error');
                return;
            }
            loadPdf(file);
        }
    };

    // ---- Placement handling ----

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (placementMode === null || isDragging) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const signer = signers[placementMode];

        // Directly place signature box without requiring signing first
        const newPlacement: SignaturePlacement = {
            id: `placement-${Date.now()}`,
            signerIndex: placementMode,
            page: currentPage - 1,
            x: Math.max(0, Math.min(x - 7.5, 85)), // center the 15% width box
            y: Math.max(0, Math.min(y - 4, 92)),
            width: 15,
            height: 8,
        };

        setPlacements((prev) => [...prev, newPlacement]);
        setPlacementMode(null);
        showToast(`Đã đặt vị trí chữ ký ${signer.role} tại trang ${currentPage}`, 'success');
    };

    const handleSignatureComplete = (result: SignatureResult) => {
        if (currentSignerIndex === null) return;

        const signatureData: SignatureData = {
            type: result.type,
            signaturePoints: result.type === 'draw' && result.signaturePoints ? result.signaturePoints : null,
            typedText: result.type === 'type' ? result.typedText : undefined,
            fontFamily: result.type === 'type' ? result.fontFamily : undefined,
            color: result.color,
        };

        const updated = [...signers];
        updated[currentSignerIndex] = {
            ...updated[currentSignerIndex],
            signed: true,
            signedAt: Date.now(),
            signatureData,
        };
        setSigners(updated);

        showToast(`✓ Đã ký cho ${signers[currentSignerIndex].role}`, 'success');
        setIsSignatureModalOpen(false);
        setCurrentSignerIndex(null);
    };

    // ---- Dragging ----

    const handlePlacementMouseDown = (e: React.MouseEvent, placementId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const placement = placements.find((p) => p.id === placementId);
        if (!placement) return;

        const parentRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
        if (!parentRect) return;

        setActivePlacementId(placementId);
        setIsDragging(true);
        setDragOffset({
            x: ((e.clientX - parentRect.left) / parentRect.width) * 100 - placement.x,
            y: ((e.clientY - parentRect.top) / parentRect.height) * 100 - placement.y,
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !activePlacementId || !containerRef.current) return;

        const pdfArea = containerRef.current.querySelector('[data-pdf-area]') as HTMLElement;
        if (!pdfArea) return;

        const rect = pdfArea.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100 - dragOffset.x;
        const y = ((e.clientY - rect.top) / rect.height) * 100 - dragOffset.y;

        setPlacements((prev) =>
            prev.map((p) =>
                p.id === activePlacementId
                    ? { ...p, x: Math.max(0, Math.min(x, 85)), y: Math.max(0, Math.min(y, 92)) }
                    : p
            )
        );
    }, [isDragging, activePlacementId, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setActivePlacementId(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // ---- Signer management ----

    const handleSignerChange = (index: number, field: keyof Signer, value: any) => {
        const updated = [...signers];
        updated[index] = { ...updated[index], [field]: value };
        setSigners(updated);
    };

    const addSigner = () => {
        const newIndex = signers.length;
        setSigners([
            ...signers,
            {
                id: `signer-${newIndex}`,
                role: `Bên ${String.fromCharCode(65 + newIndex)}`, // Bên C, D, E...
                name: '',
                signed: false,
            },
        ]);
    };

    const removeSigner = (index: number) => {
        if (signers.length <= 2) {
            showToast('Cần ít nhất 2 bên ký', 'error');
            return;
        }
        // Also remove placements for this signer
        setPlacements((prev) => prev.filter((p) => p.signerIndex !== index));
        setSigners(signers.filter((_, i) => i !== index));
    };

    const removePlacement = (placementId: string) => {
        setPlacements((prev) => prev.filter((p) => p.id !== placementId));
    };

    // ---- Save ----

    const handleSave = async () => {
        if (!pdfBase64) {
            showToast('Vui lòng upload file PDF', 'error');
            return;
        }
        if (!title.trim()) {
            showToast('Vui lòng nhập tiêu đề', 'error');
            return;
        }
        if (placements.length === 0) {
            showToast('Vui lòng đặt ít nhất một vị trí chữ ký trên PDF', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const data: PdfSignatureData = {
                title: title.trim(),
                pdfBase64,
                signers,
                placements,
                metadata: {
                    createdDate: new Date().toISOString(),
                    location: 'Việt Nam',
                },
            };
            await onSave(data);
        } catch (error) {
            console.error('Save error:', error);
            showToast('Lưu thất bại. Vui lòng thử lại.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ---- Signer colors ----

    const SIGNER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
    const getSignerColor = (index: number) => SIGNER_COLORS[index % SIGNER_COLORS.length];

    // ---- RENDER ----

    // Upload screen
    if (!pdfDoc) {
        return (
            <div className="min-h-screen bg-gradient-glass">
                <ToastContainer toasts={toasts} onRemove={removeToast} />

                {/* Header */}
                <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onCancel}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Upload PDF & Đặt Chữ Ký</h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Tải lên file PDF và chọn vị trí chữ ký số
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload Area */}
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <div
                        className={`
              relative border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer
              ${isDragOver
                                ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'
                            }
            `}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        <div className="flex flex-col items-center gap-6">
                            <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center transition-all
                ${isDragOver ? 'bg-blue-100 text-blue-600 scale-110' : 'bg-gray-100 text-gray-500'}
              `}>
                                <Upload className="w-10 h-10" />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">
                                    {isDragOver ? 'Thả file PDF ở đây' : 'Kéo & thả file PDF vào đây'}
                                </h3>
                                <p className="text-gray-500">
                                    hoặc <span className="text-blue-600 font-medium underline">chọn file từ máy</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-gray-400">
                                <span>📄 Chỉ file PDF</span>
                                <span>•</span>
                                <span>📦 Tối đa 10MB</span>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-8 glass-card rounded-2xl p-6">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Hướng dẫn
                        </h3>
                        <ol className="text-sm text-gray-600 space-y-2 ml-5 list-decimal">
                            <li>Upload file PDF cần ký</li>
                            <li>Thêm thông tin các bên ký (tên, vai trò)</li>
                            <li>Nhấn "Đặt vị trí" rồi click vào PDF để đánh dấu vị trí chữ ký</li>
                            <li>Nhấn Lưu → gửi link cho các bên ký</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    // Editor screen
    return (
        <div className="min-h-screen bg-gradient-glass" ref={containerRef}>
            <ToastContainer toasts={toasts} onRemove={removeToast} />

            {/* Header */}
            <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-[1400px] mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onCancel}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="text-lg font-bold text-gray-900 bg-transparent border-none outline-none w-full placeholder:text-gray-400"
                                    placeholder="Nhập tiêu đề văn bản..."
                                />
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {pdfFile?.name} • {totalPages} trang
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Zoom controls */}
                            <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-2 py-1">
                                <button
                                    onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <ZoomOut className="w-4 h-4 text-gray-600" />
                                </button>
                                <span className="text-xs font-medium text-gray-600 min-w-[3rem] text-center">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button
                                    onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <ZoomIn className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>

                            {/* Save */}
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="max-w-[1400px] mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* Left: PDF Viewer */}
                    <div className="flex-1 min-w-0">
                        {/* Page navigation */}
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium text-gray-700">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Placement mode indicator */}
                        {placementMode !== null && (
                            <div className="mb-3 flex items-center justify-center gap-3 py-2 px-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 animate-pulse">
                                <MousePointer2 className="w-4 h-4" />
                                <span>Click vào vị trí trên PDF để đặt chữ ký <strong>{signers[placementMode]?.role}</strong></span>
                                <button
                                    onClick={() => setPlacementMode(null)}
                                    className="ml-2 px-2 py-0.5 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors text-xs"
                                >
                                    Hủy
                                </button>
                            </div>
                        )}

                        {/* PDF canvas container */}
                        <div className="flex justify-center overflow-auto">
                            <div
                                className={`
                  relative inline-block shadow-2xl rounded-lg overflow-hidden bg-white
                  ${placementMode !== null ? 'cursor-crosshair ring-2 ring-blue-400 ring-offset-2' : ''}
                `}
                                data-pdf-area
                                onClick={handleCanvasClick}
                            >
                                <canvas ref={canvasRef} className="block" />

                                {/* Loading overlay */}
                                {isRendering && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                    </div>
                                )}

                                {/* Signature placements overlay */}
                                {placements
                                    .filter((p) => p.page === currentPage - 1)
                                    .map((placement) => {
                                        const signer = signers[placement.signerIndex];
                                        const color = getSignerColor(placement.signerIndex);
                                        return (
                                            <div
                                                key={placement.id}
                                                className={`
                          absolute group transition-shadow
                          ${activePlacementId === placement.id ? 'z-20' : 'z-10'}
                        `}
                                                style={{
                                                    left: `${placement.x}%`,
                                                    top: `${placement.y}%`,
                                                    width: `${placement.width}%`,
                                                    height: `${placement.height}%`,
                                                    border: `2px solid ${color}`,
                                                    backgroundColor: `${color}10`,
                                                    borderRadius: '6px',
                                                    cursor: 'move',
                                                }}
                                                onMouseDown={(e) => handlePlacementMouseDown(e, placement.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {/* Label */}
                                                <div
                                                    className="absolute -top-5 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-t-md whitespace-nowrap"
                                                    style={{ backgroundColor: color, color: 'white' }}
                                                >
                                                    {signer?.role || 'Unknown'}
                                                </div>

                                                {/* Signature preview */}
                                                <div className="w-full h-full flex items-center justify-center overflow-hidden p-1">
                                                    {signer?.signatureData?.type === 'type' && signer?.signatureData?.typedText ? (
                                                        <span
                                                            className="text-xs truncate"
                                                            style={{
                                                                fontFamily: signer.signatureData.fontFamily || 'cursive',
                                                                color: signer.signatureData.color || '#000',
                                                            }}
                                                        >
                                                            {signer.signatureData.typedText}
                                                        </span>
                                                    ) : signer?.signatureData?.type === 'draw' && signer?.signatureData?.signaturePoints ? (
                                                        <svg viewBox="0 0 200 60" className="w-full h-full">
                                                            {renderSignatureSVG(signer.signatureData.signaturePoints as SignaturePoint[][], signer.signatureData.color)}
                                                        </svg>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">Chữ ký</span>
                                                    )}
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    className="absolute -top-5 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] hover:bg-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removePlacement(placement.id);
                                                    }}
                                                    title="Xóa vị trí chữ ký"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>

                                                {/* Move indicator */}
                                                <div className="absolute bottom-0 right-0 p-0.5 opacity-0 group-hover:opacity-60 transition-opacity">
                                                    <Move className="w-3 h-3 text-gray-600" />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div className="w-80 flex-shrink-0 space-y-4">
                        {/* Signers */}
                        <div className="glass-card rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                                    <Users className="w-4 h-4" />
                                    Các bên ký ({signers.length})
                                </h3>
                                <button
                                    onClick={addSigner}
                                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Thêm bên ký"
                                >
                                    <Plus className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {signers.map((signer, index) => (
                                    <div
                                        key={signer.id}
                                        className="p-3 bg-white border border-gray-200 rounded-xl space-y-2"
                                        style={{ borderLeftColor: getSignerColor(index), borderLeftWidth: '3px' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="text"
                                                value={signer.role}
                                                onChange={(e) => handleSignerChange(index, 'role', e.target.value)}
                                                className="text-xs font-bold text-gray-700 bg-transparent border-none outline-none w-20"
                                            />
                                            <div className="flex items-center gap-1">
                                                {signer.signed && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md">
                                                        ✓ Đã ký
                                                    </span>
                                                )}
                                                {signers.length > 2 && (
                                                    <button
                                                        onClick={() => removeSigner(index)}
                                                        className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <input
                                            type="text"
                                            value={signer.name}
                                            onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                                            placeholder="Họ và tên"
                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-blue-300 focus:outline-none"
                                        />

                                        <div className="flex gap-1">
                                            {/* Sign button */}
                                            <button
                                                onClick={() => {
                                                    setCurrentSignerIndex(index);
                                                    setIsSignatureModalOpen(true);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                            >
                                                <PenLine className="w-3 h-3" />
                                                {signer.signed ? 'Ký lại' : 'Ký tên'}
                                            </button>

                                            {/* Place on PDF button */}
                                            <button
                                                onClick={() => {
                                                    setPlacementMode(index);
                                                    showToast(`Click vào vị trí trên PDF để đặt chữ ký ${signer.role}`, 'info');
                                                }}
                                                className={`
                          flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-colors
                          ${placementMode === index
                                                        ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300'
                                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                                    }
                        `}
                                            >
                                                <MousePointer2 className="w-3 h-3" />
                                                Đặt vị trí
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Placements list */}
                        {placements.length > 0 && (
                            <div className="glass-card rounded-2xl p-4">
                                <h3 className="font-bold text-gray-900 text-sm mb-3">
                                    📍 Vị trí chữ ký ({placements.length})
                                </h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {placements.map((placement) => {
                                        const signer = signers[placement.signerIndex];
                                        const color = getSignerColor(placement.signerIndex);
                                        return (
                                            <div
                                                key={placement.id}
                                                className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="font-medium">{signer?.role}</span>
                                                    <span className="text-gray-400">Trang {placement.page + 1}</span>
                                                </div>
                                                <button
                                                    onClick={() => removePlacement(placement.id)}
                                                    className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tips */}
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                            <h4 className="font-bold text-blue-900 text-sm mb-2">💡 Mẹo</h4>
                            <ul className="text-xs text-blue-700 space-y-1">
                                <li>• Nhấn "Đặt vị trí" rồi click vào PDF</li>
                                <li>• Kéo chữ ký để di chuyển vị trí</li>
                                <li>• Hover vào chữ ký để xóa</li>
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
