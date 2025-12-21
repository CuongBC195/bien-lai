'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Loader2, 
  FileText, 
  Plus, 
  LogIn, 
  UserPlus,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowRight,
  Sparkles,
  Filter,
  Briefcase,
  Home as HomeIcon,
  Wallet,
  ShoppingCart,
  Wrench,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { CONTRACT_TEMPLATES, TEMPLATE_CATEGORIES, type ContractTemplate } from '@/data/templates';
import { formatVietnameseDate } from '@/lib/utils';
import type { Receipt } from '@/lib/kv';
import ReceiptViewKV from '@/components/ReceiptViewKV';
import ContractViewKV from '@/components/ContractViewKV';
import DashboardKV from '@/components/DashboardKV';

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Briefcase,
  Home: HomeIcon,
  Wallet,
  ShoppingCart,
  Wrench,
  Receipt: ReceiptIcon,
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
          if (data.receipt.document) {
            setDocumentType('contract');
          } else {
            setDocumentType('receipt');
          }
        }
      } catch (error) {
        console.error('Error detecting document type:', error);
        setDocumentType('receipt');
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

  if (documentType === 'contract') {
    return <ContractViewKV receiptId={receiptId} />;
  }

  return <ReceiptViewKV receiptId={receiptId} />;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [publicDocuments, setPublicDocuments] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'templates' | 'documents'>('templates');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  useEffect(() => {
    // Priority 1: Check for receipt ID in URL (Signer mode)
    const idParam = searchParams.get('id');
    
    if (idParam) {
      setReceiptId(idParam);
      setIsLoading(false);
      return;
    }

    // Priority 2: Load public data
    const loadData = async () => {
      try {
        // Check auth status (check both admin and user)
        const authRes = await fetch('/api/auth/check');
        const authData = await authRes.json();
        const authenticated = authData.authenticated || false;
        const role = authData.role || null;
        
        setIsAuthenticated(authenticated);
        setUserRole(role);
        
        // If admin is logged in, don't load user documents
        if (role === 'admin') {
          setPublicDocuments([]);
          setIsLoading(false);
          return;
        }

        // 🔒 SECURITY: Only load documents if authenticated
        if (authenticated) {
          const docsRes = await fetch('/api/receipts/list');
          const docsData = await docsRes.json();
          if (docsData.success) {
            // Show only signed documents
            const signed = (docsData.receipts || []).filter((r: Receipt) => r.status === 'signed');
            setPublicDocuments(signed.slice(0, 20)); // Show latest 20
          }
        } else {
          // Not authenticated - don't load documents
          setPublicDocuments([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setIsAuthenticated(false);
        setPublicDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [searchParams]);

  // Priority 1: Signer mode - Show receipt/contract view for signing
  if (receiptId) {
    return <ReceiptOrContractView receiptId={receiptId} />;
  }

  // Note: / is always the public home page, admin should access /admin directly

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

  const filteredTemplates = CONTRACT_TEMPLATES.filter((template) => {
    const matchesCategory =
      selectedCategory === 'Tất cả' || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredDocuments = publicDocuments.filter((doc) => {
    const search = searchQuery.toLowerCase();
    const title = doc.document?.title || doc.data?.title || doc.id;
    return title.toLowerCase().includes(search);
  });

  return (
    <div className="min-h-screen bg-gradient-glass">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/90 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Hợp Đồng Điện Tử</h1>
                <p className="text-sm text-gray-500">Tạo và quản lý hợp đồng trực tuyến</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <button
                  onClick={() => router.push('/user/dashboard')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
                >
                  <FileText className="w-5 h-5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/user/login')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="hidden sm:inline">Đăng nhập</span>
                  </button>
                  <button
                    onClick={() => router.push('/user/register')}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-xl transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="hidden sm:inline">Đăng ký</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Tạo và quản lý hợp đồng điện tử dễ dàng
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Chọn từ nhiều mẫu hợp đồng có sẵn hoặc tạo văn bản mới. Ký số điện tử an toàn, nhanh chóng.
          </p>
          {!isAuthenticated && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => router.push('/user/login')}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 rounded-xl transition-all font-medium"
              >
                <Plus className="w-5 h-5" />
                Tạo hợp đồng mới
              </button>
              <p className="text-sm text-gray-500">
              </p>
            </div>
          )}
          {isAuthenticated && (
            <button
              onClick={() => router.push('/user/create')}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 rounded-xl transition-all font-medium mx-auto"
            >
              <Plus className="w-5 h-5" />
              Tạo hợp đồng mới
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setSelectedTab('templates')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'templates'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Mẫu hợp đồng
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setSelectedTab('documents')}
              className={`px-4 py-2 font-medium transition-colors ${
                selectedTab === 'documents'
                  ? 'text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Hợp đồng đã ký ({publicDocuments.length})
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={
                selectedTab === 'templates'
                  ? 'Tìm kiếm mẫu hợp đồng...'
                  : 'Tìm kiếm hợp đồng...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
            />
          </div>

          {/* Category Filter (only for templates tab) */}
          {selectedTab === 'templates' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                    selectedCategory === category
                      ? 'bg-black text-white shadow-lg'
                      : 'bg-white/80 text-gray-600 hover:bg-white border border-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Templates Tab */}
        {selectedTab === 'templates' && (
          <>
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
                      onClick={() => {
                        // Show preview first
                        setPreviewTemplate(template);
                      }}
                      className="glass-card rounded-2xl p-6 text-left transition-all hover:scale-105 hover:shadow-xl group"
                    >
                      {/* Icon */}
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorClass} transition-transform group-hover:scale-110`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        {!isAuthenticated && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                            Cần đăng nhập
                          </span>
                        )}
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
          </>
        )}

        {/* Template Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = ICON_MAP[previewTemplate.icon] || FileText;
                    const colorClass = COLOR_MAP[previewTemplate.color] || COLOR_MAP.gray;
                    return (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorClass}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{previewTemplate.name}</h3>
                    <p className="text-sm text-gray-500">{previewTemplate.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <span className="text-2xl text-gray-400">×</span>
                </button>
              </div>

              {/* Content Preview */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="bg-white rounded-xl p-8 shadow-sm min-h-[400px]">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.content }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">👥 {previewTemplate.signers.length} bên ký:</span>
                  <span className="ml-2">
                    {previewTemplate.signers.map(s => s.role).join(', ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 glass-button-outline rounded-xl transition-all"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      if (isAuthenticated) {
                        sessionStorage.setItem('selectedTemplate', JSON.stringify(previewTemplate));
                        router.push(`/user/editor?template=${previewTemplate.id}`);
                      } else {
                        setPreviewTemplate(null);
                        router.push('/user/login');
                      }
                    }}
                    className="px-6 py-2 bg-black text-white hover:bg-gray-800 rounded-xl transition-all font-medium"
                  >
                    {isAuthenticated ? 'Sử dụng mẫu này' : 'Đăng nhập để sử dụng'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {selectedTab === 'documents' && (
          <div className="space-y-4">
            {filteredDocuments.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có hợp đồng nào được ký</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const title = doc.document?.title || doc.data?.title || doc.id;
                const isContract = !!doc.document;

                return (
                  <div
                    key={doc.id}
                    className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => router.push(`/?id=${doc.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-gray-900">{title}</h3>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            Đã ký
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatVietnameseDate(new Date(doc.createdAt))}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {isContract ? 'Hợp đồng' : 'Biên lai'}
                          </span>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <Eye className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
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
