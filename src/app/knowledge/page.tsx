"use client";

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { KnowledgeSearch } from '@/components/KnowledgeSearch';

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
