'use client';

import { useState } from 'react';
import RealtimeAgent from '@/components/RealtimeAgent';

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('この画像の内容を実況風に説明し、重要点を箇条書きで。');

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setDescription('');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('prompt', prompt);

    const res = await fetch('/api/analyze-image', { method: 'POST', body: formData });
    if (!res.ok || !res.body) {
      setLoading(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
      setDescription(text);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Realtime Vision Commentary</h2>
      <div className="space-y-2">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="実況のスタイルや制約を入力"
        />
        <button
          onClick={handleAnalyze}
          disabled={!file || loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? '分析中...' : '画像を分析して実況開始'}
        </button>
      </div>

      {description && (
        <div className="space-y-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">説明テキスト</div>
            <pre className="whitespace-pre-wrap text-sm p-3 bg-neutral-50 rounded border">{description}</pre>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">リアルタイム実況</div>
            <RealtimeAgent imageDescription={description} />
          </div>
        </div>
      )}
    </div>
  );
}


