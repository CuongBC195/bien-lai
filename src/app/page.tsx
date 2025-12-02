'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import LoginForm from '@/components/LoginForm';
import Dashboard from '@/components/Dashboard';
import ReceiptViewKV from '@/components/ReceiptViewKV';

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

    // Priority 2: Check auth status (Admin mode)
    const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    setIsLoading(false);
  }, [searchParams]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isLoggedIn');
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

  // Priority 1: Signer mode - Show receipt view for signing
  if (receiptId) {
    return <ReceiptViewKV receiptId={receiptId} />;
  }

  // Priority 2: Not logged in - show login form
  if (!isLoggedIn) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Priority 3: Logged in - show admin dashboard
  return <Dashboard onLogout={handleLogout} />;
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
