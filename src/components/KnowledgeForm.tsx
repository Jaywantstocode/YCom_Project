"use client";

import { useState, useEffect } from 'react';
import { useKnowledgeSearch } from '@/hooks/useKnowledge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Save, 
  X, 
  Plus, 
  Tag,
  Loader2,
  ExternalLink 
} from 'lucide-react';
import { 
  type ToolKnowledge,
  type ToolKnowledgeInsert,
  type ToolKnowledgeUpdate,
  KNOWLEDGE_TAGS 
} from '@/types/knowledge';

interface KnowledgeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editData?: ToolKnowledge;
}

export function KnowledgeForm({ 
  isOpen, 
  onClose, 
  onSuccess,
  editData 
}: KnowledgeFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { createKnowledge, updateKnowledge } = useKnowledgeSearch();

  const isEditing = !!editData;

  // Initialize form with edit data
  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '');
      setContent(editData.content || '');
      setUrl(editData.url || '');
      setTags(editData.tags || []);
    } else {
      // Reset form for new creation
      setTitle('');
      setContent('');
      setUrl('');
      setTags([]);
    }
    setNewTag('');
    setError(null);
    setSuccess(false);
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags(prev => [...prev, trimmedTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleQuickTagAdd = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      if (isEditing && editData) {
        const updates: ToolKnowledgeUpdate = {
          title: title.trim() || null,
          content: content.trim() || null,
          url: url.trim() || null,
          tags: tags.length > 0 ? tags : null,
        };

        const { error } = await updateKnowledge(editData.id, updates);
        
        if (error) {
          setError(error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 1500);
        }
      } else {
        const knowledgeData: ToolKnowledgeInsert = {
          title: title.trim() || null,
          content: content.trim() || null,
          url: url.trim() || null,
          tags: tags.length > 0 ? tags : null,
        };

        const { error } = await createKnowledge(knowledgeData);
        
        if (error) {
          setError(error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 1500);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (editData) {
      setTitle(editData.title || '');
      setContent(editData.content || '');
      setUrl(editData.url || '');
      setTags(editData.tags || []);
    } else {
      setTitle('');
      setContent('');
      setUrl('');
      setTags([]);
    }
    setNewTag('');
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {isEditing ? 'ナレッジを編集' : '新しいナレッジを作成'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ナレッジのタイトルを入力"
                disabled={loading}
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">URL（任意）</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={loading}
                />
                {url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(url, '_blank')}
                    disabled={loading}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="ナレッジの詳細内容を入力..."
                rows={8}
                disabled={loading}
              />
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label>タグ</Label>
              
              {/* Add new tag */}
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="タグを追加"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={loading || !newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick tag buttons */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600">クイック追加:</div>
                <div className="flex flex-wrap gap-2">
                  {KNOWLEDGE_TAGS.CATEGORIES.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickTagAdd(tag)}
                      disabled={loading || tags.includes(tag)}
                      className="text-xs"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selected tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">選択中のタグ:</div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>
                  {isEditing ? 'ナレッジを更新しました！' : 'ナレッジを作成しました！'}
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={loading || (!title.trim() && !content.trim())}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? '更新中...' : '作成中...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? '更新' : '作成'}
                  </>
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleReset}
                disabled={loading}
              >
                リセット
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={loading}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
