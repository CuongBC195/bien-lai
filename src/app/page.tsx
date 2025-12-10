'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import LoginFormKV from '@/components/LoginFormKV';
import DashboardKV from '@/components/DashboardKV';
import ReceiptViewKV from '@/components/ReceiptViewKV';
import ContractViewKV from '@/components/ContractViewKV';

// Component to detect and render correct view (Receipt or Contract)
function ReceiptOrContractView({ receiptId }: { receiptId: string }) {
  const [documentType, setDocumentType] = useState<'receipt' | 'contract' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectType = async () => {
      try {
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        const data = await res.json();
        
        if (data.success && data.receipt) {
          // Check if it's a contract (has document field) or receipt
          if (data.receipt.document) {
            setDocumentType('contract');
          } else {
            setDocumentType('receipt');
          }
        }
      } catch (error) {
        console.error('Error detecting document type:', error);
        setDocumentType('receipt'); // Default to receipt on error
      } finally {
        setLoading(false);
      }
    };

    detectType();
  }, [receiptId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  // Render appropriate component based on document type
  if (documentType === 'contract') {
    return <ContractViewKV receiptId={receiptId} />;
  }

  return <ReceiptViewKV receiptId={receiptId} />;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Priority 1: Check for receipt ID in URL (Signer mode)
    const idParam = searchParams.get('id');
    
    if (idParam) {
      setReceiptId(idParam);
      setIsLoading(false);
      return;
    }

    // Priority 2: Check auth status via API (Admin mode)
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        setIsLoggedIn(data.authenticated);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [searchParams]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setIsLoggedIn(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tải...</span>
          </div>
        </div>
      </div>
    );
  }

  // Priority 1: Signer mode - Show receipt/contract view for signing
  if (receiptId) {
    return <ReceiptOrContractView receiptId={receiptId} />;
  }

  // Priority 2: Not logged in - show login form
  if (!isLoggedIn) {
    return <LoginFormKV onLogin={handleLoginSuccess} />;
  }

  // Priority 3: Logged in - show admin dashboard
  return <DashboardKV onLogout={handleLogout} />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tải...</span>
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
