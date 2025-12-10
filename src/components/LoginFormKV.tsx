'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, FileText, AlertCircle } from 'lucide-react';

interface LoginFormKVProps {
  onLogin: () => void;
}

export default function LoginFormKV({ onLogin }: LoginFormKVProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setWarning('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        onLogin();
      } else {
        // 🔒 SECURITY: Handle rate limiting (429)
        if (response.status === 429 || data.code === 'RATE_LIMITED') {
          setError(data.error || 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau.');
          setIsRateLimited(true);
          // Disable form for rate limit duration
          setTimeout(() => {
            setIsRateLimited(false);
            setError('');
          }, (data.retryAfter || 900) * 1000); // Default 15 minutes
        } else {
          setError(data.error || 'Mật khẩu không đúng');
          
          // Show warning if remaining attempts are low
          if (data.warning) {
            setWarning(data.warning);
          }
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-glass flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-8 w-full max-w-md shadow-2xl">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black/90 rounded-2xl mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">E-Receipt Admin</h1>
          <p className="text-gray-500 mt-2">Đăng nhập để quản lý biên lai</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu quản trị
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-12 pr-12 py-3.5 glass-input rounded-xl"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* 🔒 Warning for low remaining attempts */}
          {warning && !error && (
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{warning}</span>
            </div>
          )}

          {/* 🔒 Error message (including rate limit) */}
          {error && (
            <div className={`flex items-center gap-2 p-4 rounded-xl border ${
              isRateLimited 
                ? 'text-red-800 bg-red-100 border-red-200' 
                : 'text-red-700 bg-red-50 border-red-100'
            }`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || isRateLimited}
            className="w-full glass-button py-3.5 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang xác thực...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Footer */}
      </div>
    </div>
  );
}
