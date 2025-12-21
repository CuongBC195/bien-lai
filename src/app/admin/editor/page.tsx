'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import DocumentEditorKV, { DocumentEditorData } from '@/components/DocumentEditorKV';
import { getTemplateById, type ContractTemplate } from '@/data/templates';
import { useToast, ToastContainer } from '@/components/Toast';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast, removeToast } = useToast();

  const [template, setTemplate] = useState<ContractTemplate | undefined>();
  const [initialData, setInitialData] = useState<any>();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      
      if (data.success && data.authenticated && data.role === 'admin') {
        setIsAuthenticated(true);
        loadEditorData();
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadEditorData = () => {
    const templateId = searchParams.get('template');
    const editId = searchParams.get('edit');
    
    if (editId) {
      // Edit mode - load from sessionStorage
      const contractData = sessionStorage.getItem('editingContract');
      if (contractData) {
        try {
          const contract = JSON.parse(contractData);
          if (contract.document) {
            setInitialData({
              type: contract.document.type,
              templateId: contract.document.templateId,
              title: contract.document.title,
              content: contract.document.content,
              signers: contract.document.signers,
              metadata: contract.document.metadata,
            });
            setMode('edit');
          }
        } catch (error) {
          console.error('Error loading contract:', error);
        }
        sessionStorage.removeItem('editingContract');
      }
    } else if (templateId) {
      // Create mode - load template
      const t = getTemplateById(templateId);
      setTemplate(t);
      setMode('create');
    }
  };

  const handleSave = async (data: DocumentEditorData) => {
    try {
      const isEdit = mode === 'edit' && searchParams.get('edit');
      
      if (isEdit) {
        // Update existing contract
        const response = await fetch('/api/receipts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: searchParams.get('edit'),
            document: data 
          }),
        });

        const result = await response.json();

        if (result.success) {
          showToast('Cập nhật thành công!', 'success');
          setTimeout(() => router.push('/admin'), 1000);
        } else {
          showToast(result.error || 'Có lỗi xảy ra', 'error');
        }
      } else {
        // Create new contract
        const response = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: data }),
        });

        const result = await response.json();

        if (result.success) {
          showToast('Tạo hợp đồng thành công!', 'success');
          setTimeout(() => router.push('/admin'), 1000);
        } else {
          showToast(result.error || 'Có lỗi xảy ra', 'error');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Không thể lưu. Vui lòng thử lại.', 'error');
    }
  };

  const handleCancel = () => {
    router.push('/admin/create');
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
      <DocumentEditorKV
        template={template}
        initialData={initialData}
        onSave={handleSave}
        onCancel={handleCancel}
        mode={mode}
      />
    </>
  );
}

export default function AdminEditorPage() {
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
      <EditorContent />
    </Suspense>
  );
}

