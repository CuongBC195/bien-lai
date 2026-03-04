'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Briefcase,
  Home,
  Wallet,
  ShoppingCart,
  Wrench,
  Receipt,
  ArrowLeft,
  Search,
  Filter,
  Sparkles,
  Upload,
  PenLine,
} from 'lucide-react';
import { CONTRACT_TEMPLATES, TEMPLATE_CATEGORIES, type ContractTemplate } from '@/data/templates';

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Briefcase,
  Home,
  Wallet,
  ShoppingCart,
  Wrench,
  Receipt,
};

// Color mapping
const COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
  green: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200',
  purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
  orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
};

export default function UserCreatePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Filter templates
  const filteredTemplates = CONTRACT_TEMPLATES.filter((template) => {
    const matchesCategory =
      selectedCategory === 'Tất cả' || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelectTemplate = (template: ContractTemplate) => {
    router.push(`/user/editor?template=${template.id}`);
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
    <div className="min-h-screen bg-gradient-glass">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/user/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Chọn Mẫu Văn Bản</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Chọn mẫu có sẵn hoặc tạo văn bản trống
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="w-4 h-4" />
              <span>{CONTRACT_TEMPLATES.length} mẫu khả dụng</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mẫu văn bản..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
            {TEMPLATE_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${selectedCategory === category
                  ? 'bg-black text-white shadow-lg'
                  : 'bg-white/80 text-gray-600 hover:bg-white border border-gray-200'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Upload PDF Card */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/user/pdf-sign')}
            className="w-full glass-card rounded-2xl p-6 text-left transition-all hover:scale-[1.01] hover:shadow-xl group border-2 border-dashed border-blue-200 hover:border-blue-400 bg-gradient-to-r from-blue-50/50 to-indigo-50/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600 transition-transform group-hover:scale-110">
                <Upload className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                  Upload PDF & Đặt Chữ Ký
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Mới</span>
                </h3>
                <p className="text-sm text-gray-500">
                  Tải lên file PDF có sẵn, chọn vị trí và ký chữ ký số trực tiếp trên tài liệu
                </p>
              </div>
              <div className="flex items-center gap-2 text-blue-500 group-hover:text-blue-700 transition-colors">
                <PenLine className="w-5 h-5" />
              </div>
            </div>
          </button>
        </div>

        {/* Template Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Không tìm thấy mẫu phù hợp</p>
            <p className="text-gray-400 text-sm mt-2">
              Thử thay đổi từ khóa hoặc danh mục tìm kiếm
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const Icon = ICON_MAP[template.icon] || FileText;
              const colorClass = COLOR_MAP[template.color] || COLOR_MAP.gray;

              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="glass-card rounded-2xl p-6 text-left transition-all hover:scale-105 hover:shadow-xl group"
                >
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border ${colorClass} transition-transform group-hover:scale-110`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-black">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {template.description}
                  </p>

                  {/* Category Badge */}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                    {template.category}
                  </span>

                  {/* Signers Info */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                    <span>👥 {template.signers.length} bên ký</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-2xl">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Mẹo sử dụng
          </h3>
          <ul className="text-sm text-blue-700 space-y-1 ml-7">
            <li>• Chọn mẫu phù hợp với nhu cầu của bạn</li>
            <li>• Sau khi chọn, bạn có thể chỉnh sửa toàn bộ nội dung</li>
            <li>• Hệ thống tự động thêm Header (Quốc hiệu) và Footer (Chữ ký)</li>
            <li>• Chọn "Văn bản trống" nếu muốn soạn từ đầu</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
