"use client";

import { useState, useCallback, useMemo } from 'react';
import { useKnowledgeSearch } from '@/hooks/useKnowledge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Plus, 
  ExternalLink, 
  Tag, 
  Calendar,
  Sparkles,
  FileText 
} from 'lucide-react';
import { 
  type KnowledgeSearchParams, 
  type ToolKnowledgeSearchResult,
  KNOWLEDGE_TAGS 
} from '@/types/knowledge';
import { KnowledgeForm } from './KnowledgeForm';

interface KnowledgeSearchProps {
  onItemSelect?: (item: ToolKnowledgeSearchResult) => void;
  maxResults?: number;
  showCreateButton?: boolean;
}

export function KnowledgeSearch({ 
  onItemSelect, 
  maxResults = 20,
  showCreateButton = true 
}: KnowledgeSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);

  const searchParams: KnowledgeSearchParams = useMemo(() => ({
    query: searchQuery.trim() || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: maxResults,
  }), [searchQuery, selectedTags, maxResults]);

  const { data: searchResults, loading, error } = useKnowledgeSearch(searchParams);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSimilarityColor = (similarity?: number) => {
    if (!similarity) return 'bg-gray-100 text-gray-600';
    if (similarity > 0.9) return 'bg-green-100 text-green-800';
    if (similarity > 0.8) return 'bg-blue-100 text-blue-800';
    if (similarity > 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              ナレッジ検索
            </CardTitle>
            {showCreateButton && (
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                新規作成
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ナレッジを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tag Filters */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">カテゴリで絞り込み:</div>
            <div className="flex flex-wrap gap-2">
              {KNOWLEDGE_TAGS.CATEGORIES.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleTagToggle(tag)}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Active Filters */}
          {(searchQuery || selectedTags.length > 0) && (
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-500">フィルタ:</div>
              {searchQuery && (
                <Badge variant="secondary">
                  検索: {searchQuery}
                </Badge>
              )}
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                クリア
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <div className="space-y-4">
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-4 text-center text-red-600">
              エラーが発生しました: {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && searchResults && searchResults.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <div className="text-lg font-medium mb-2">ナレッジが見つかりませんでした</div>
              <div className="text-sm">検索条件を変更してみてください</div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && searchResults && searchResults.length > 0 && (
          <>
            <div className="text-sm text-gray-600">
              {searchResults.length} 件のナレッジが見つかりました
            </div>
            
            <div className="space-y-4">
              {searchResults.map((item) => (
                <Card 
                  key={item.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    onItemSelect ? 'hover:border-blue-300' : ''
                  }`}
                  onClick={() => onItemSelect?.(item)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-lg line-clamp-1">
                          {item.title || '無題'}
                        </h3>
                        <div className="flex items-center gap-2 ml-4">
                          {item.similarity !== undefined && item.similarity > 0 && (
                            <Badge 
                              variant="secondary" 
                              className={getSimilarityColor(item.similarity)}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              {Math.round(item.similarity * 100)}%
                            </Badge>
                          )}
                          {item.search_type === 'semantic' && (
                            <Badge variant="outline" className="text-xs">
                              AI検索
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Content Preview */}
                      {item.content && (
                        <p className="text-gray-600 text-sm line-clamp-2">
                          {item.content}
                        </p>
                      )}

                      {/* URL */}
                      {item.url && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <ExternalLink className="h-3 w-3" />
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.url}
                          </a>
                        </div>
                      )}

                      {/* Tags and Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {item.tags?.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        {item.created_at && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {formatDate(item.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Knowledge Form Modal */}
      {showForm && (
        <KnowledgeForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            // Refresh search results will be handled by SWR mutation
          }}
        />
      )}
    </div>
  );
}
