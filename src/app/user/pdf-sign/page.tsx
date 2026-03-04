'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import PdfSignatureEditor, { PdfSignatureData } from '@/components/PdfSignatureEditor';
import { useToast, ToastContainer } from '@/components/Toast';

function PdfSignContent() {
    const router = useRouter();
    const { toasts, showToast, removeToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/user/check');
            const data = await res.json();

            if (data.authenticated && data.role === 'user') {
                setIsAuthenticated(true);
            } else {
                router.push('/user/login');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            router.push('/user/login');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: PdfSignatureData) => {
        try {
            const response = await fetch('/api/receipts/create-from-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.success) {
                showToast('Đã lưu văn bản PDF thành công!', 'success');
                setTimeout(() => router.push('/user/dashboard'), 1000);
            } else {
                showToast(result.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            showToast('Không thể lưu. Vui lòng thử lại.', 'error');
        }
    };

    const handleCancel = () => {
        router.push('/user/create');
    };

    if (loading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500">Đang kiểm tra...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
            <PdfSignatureEditor
                onSave={handleSave}
                onCancel={handleCancel}
            />
        </>
    );
}

export default function PdfSignPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
                    <div className="flex flex-col items-center gap-4">
                        <FileText className="w-12 h-12 text-gray-400 animate-pulse" />
                        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    </div>
                </div>
            }
        >
            <PdfSignContent />
        </Suspense>
    );
}
