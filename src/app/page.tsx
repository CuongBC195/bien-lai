'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import LoginFormKV from '@/components/LoginFormKV';
import DashboardKV from '@/components/DashboardKV';
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
    const loggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    setIsLoggedIn(loggedIn);
    setIsLoading(false);
  }, [searchParams]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-400">
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
    return <LoginFormKV onLogin={handleLoginSuccess} />;
  }

  // Priority 3: Logged in - show admin dashboard
  return <DashboardKV onLogout={handleLogout} />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-gray-400">
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
