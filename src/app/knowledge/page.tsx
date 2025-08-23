"use client";

import { ProtectedRoute } from '@/components/ProtectedRoute';
import dynamicImport from 'next/dynamic';

// Force dynamic rendering to avoid SSR issues with Supabase client
export const dynamic = 'force-dynamic';

// Dynamically import KnowledgeSearch to avoid SSR issues
const KnowledgeSearch = dynamicImport(() => import('@/components/KnowledgeSearch').then(mod => ({ default: mod.KnowledgeSearch })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="ml-2">読み込み中...</span>
    </div>
  ),
});

export default function KnowledgePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">ナレッジベース</h1>
            <p className="text-gray-600 mt-2">
              AI powered semantic search でナレッジを検索・管理
            </p>
          </div>
          
          <KnowledgeSearch />
        </div>
      </div>
    </ProtectedRoute>
  );
}
