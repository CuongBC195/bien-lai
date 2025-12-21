'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardKV from '@/components/DashboardKV';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        
        if (data.success && data.authenticated && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          // Not admin, redirect to login
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Redirect to home page after logout
    router.push('/');
  };

  if (isLoading) {
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

  if (!isAdmin) {
    return null; // Will redirect
  }

  return <DashboardKV onLogout={handleLogout} />;
}

