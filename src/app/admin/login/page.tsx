'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginFormKV from '@/components/LoginFormKV';

export default function AdminLoginPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if already logged in as admin
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        
        if (data.success && data.authenticated && data.role === 'admin') {
          // Already logged in as admin, redirect to admin dashboard
          router.push('/admin');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLoginSuccess = () => {
    // Redirect to admin dashboard
    router.push('/admin');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-glass flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-500">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  return <LoginFormKV onLogin={handleLoginSuccess} />;
}

