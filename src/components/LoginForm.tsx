'use client';

import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, FileText } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123';
    
    if (passcode === adminPass) {
      sessionStorage.setItem('isLoggedIn', 'true');
      onLoginSuccess();
    } else {
      setError('Mật khẩu không chính xác');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-glass flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black/90 rounded-2xl mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng nhập Admin</h1>
          <p className="text-gray-500 mt-2">Quản lý biên nhận tiền</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="passcode" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
                placeholder="Nhập mật khẩu..."
                autoFocus
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 p-4 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !passcode}
            className="w-full glass-button py-3.5 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang xác thực...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-8">
          Hệ thống quản lý biên nhận tiền
        </p>
      </div>
    </div>
  );
}
