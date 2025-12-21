'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, AlertCircle, FileText, Eye, EyeOff } from 'lucide-react';
import { useToast } from './Toast';

export default function UserLoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if already logged in
    fetch('/api/user/check')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.role === 'user') {
          router.push('/user/dashboard');
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'RATE_LIMITED') {
          const retryAfter = response.headers.get('Retry-After');
          const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 15;
          setError(`Bạn đã nhập sai quá nhiều lần. Thử lại sau ${minutes} phút.`);
        } else if (data.code === 'EMAIL_NOT_VERIFIED') {
          setError(data.error || 'Vui lòng xác thực email trước khi đăng nhập.');
        } else {
          setError(data.error || 'Đăng nhập thất bại. Vui lòng thử lại.');
          
          // Try to extract remaining attempts from error message
          const match = data.error?.match(/Còn (\d+) lần thử/);
          if (match) {
            setRemainingAttempts(parseInt(match[1]));
          }
        }
        return;
      }

      showToast('Đăng nhập thành công!', 'success');
      router.push('/user/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
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
          <h1 className="text-2xl font-bold text-gray-900">Đăng nhập</h1>
          <p className="text-gray-500 mt-2">Đăng nhập vào tài khoản của bạn</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-12 pr-12 py-3.5 glass-input rounded-xl"
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

          {/* Warning for low remaining attempts */}
          {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 3 && !error && (
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">⚠️ Còn {remainingAttempts} lần thử...</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 p-4 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !formData.email || !formData.password}
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

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Chưa có tài khoản?{' '}
              <a href="/user/register" className="font-medium text-gray-900 hover:text-black">
                Đăng ký ngay
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

