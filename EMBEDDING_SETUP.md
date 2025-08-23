# 🧠 YCom Embedding & Semantic Search セットアップガイド

## 🎉 実装完了！

参考にしていただいた別プロジェクトのembedding実装を基に、YComにも高度なAI検索機能を追加しました！

## ✅ 実装済み機能

### 📊 コア機能
- ✅ **AI SDK統合** - OpenAI text-embedding-3-small model
- ✅ **Semantic Search** - pgvector + HNSW インデックス
- ✅ **Hybrid Search** - セマンティック検索 + テキスト検索のフォールバック
- ✅ **Knowledge Management** - 作成・編集・削除・検索
- ✅ **Log Summary Search** - ユーザー固有のログ検索
- ✅ **認証統合** - 既存のAuth機能と完全統合

### 🔧 技術仕様

#### Embedding生成
```typescript
// 汎用テキスト
generateEmbedding(text: string)

// ナレッジ（タイトル+内容+タグ）
generateKnowledgeEmbedding(title, content, tags)

// ログサマリ（構造化データ対応）
generateLogSummaryEmbedding(summaryText, structured, tags)
```

#### セマンティック検索関数（SQL）
- `search_tool_knowledge_semantic()` - ナレッジ検索
- `search_log_summary_semantic()` - ログ検索
- `search_tool_knowledge_hybrid()` - ハイブリッド検索
- `get_similar_tool_knowledge()` - 類似ナレッジ検索

#### React Hooks
```typescript
// ナレッジ管理
useKnowledgeSearch(params)
useKnowledge(id)
useSimilarKnowledge(sourceId)

// ログサマリ管理
useLogSummarySearch(params)
useLogSummary(id)
```

## 🚀 セットアップ手順

### 1. 必要なSQLファイルの実行

以下のSQLファイルをSupabaseで実行してください：

```bash
# 1. RLSポリシー（既に実行済みの場合はスキップ）
sql/setup_rls_policies.sql

# 2. セマンティック検索関数
sql/semantic_search_functions.sql
```

### 2. 環境変数の追加

`.env.local` に以下を追加：

```env
# 既存の変数
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI API Key（新規追加）
OPENAI_API_KEY=your_openai_api_key
```

### 3. 開発サーバーの再起動

```bash
npm run dev
```

## 🎮 使用方法

### ナレッジ管理

1. **アクセス**: トップページの「ナレッジベース」ボタンをクリック
2. **検索**: 
   - テキスト検索: 自然言語で質問
   - カテゴリ絞り込み: タグでフィルタリング
   - AI検索: embedding による意味検索
3. **作成**: 「新規作成」ボタンで新しいナレッジを追加
4. **編集**: ナレッジ項目をクリックして編集

### AI検索の特徴

```typescript
// 自然言語検索例
"React のパフォーマンス最適化方法"
"エラーが出た時の対処法"
"データベース設計のベストプラクティス"

// 結果には類似度スコアが表示
similarity: 0.95 // 95% マッチ
```

### 開発者向け使用例

```typescript
// ナレッジ検索
const { data, loading, createKnowledge } = useKnowledgeSearch({
  query: "React hooks",
  tags: ["development"],
  limit: 10
});

// 新しいナレッジ作成
await createKnowledge({
  title: "React パフォーマンス最適化",
  content: "詳細な内容...",
  tags: ["react", "performance"],
  url: "https://example.com"
});
```

## 📊 データベース構造

### tool_knowledge テーブル
```sql
CREATE TABLE public.tool_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  url text,
  tags text[] DEFAULT '{}',
  content text,
  embedding public.vector,  -- pgvector型
  created_at timestamptz DEFAULT now()
);
```

### log_summary テーブル
```sql
CREATE TABLE public.log_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action_log_id uuid REFERENCES user_action_log(id),
  summary_text text,
  structured jsonb,
  tags text[] DEFAULT '{}',
  embedding public.vector,  -- pgvector型
  created_at timestamptz DEFAULT now()
);
```

### インデックス最適化
```sql
-- HNSW インデックス（高速検索用）
CREATE INDEX tool_knowledge_embedding_hnsw_idx 
ON tool_knowledge USING hnsw (embedding vector_cosine_ops);

CREATE INDEX log_summary_embedding_hnsw_idx 
ON log_summary USING hnsw (embedding vector_cosine_ops);
```

## 🔍 検索アルゴリズム

### 1. セマンティック検索優先
```sql
-- コサイン類似度での検索
1 - (embedding <=> query_embedding) > 0.7
```

### 2. テキスト検索フォールバック
```sql
-- LIKE検索 + 配列検索
title ILIKE '%query%' OR content ILIKE '%query%' OR 'query' = ANY(tags)
```

### 3. ハイブリッド結果
- セマンティック結果 + テキスト結果
- 重複除去 + 類似度ソート

## 🎨 UI/UX 特徴

### デザイン統合
- 既存のshadcn/ui スタイルと統一
- 類似度スコアの視覚化
- AI検索バッジの表示
- リアルタイム検索

### アクセシビリティ
- キーボードナビゲーション
- スクリーンリーダー対応
- レスポンシブデザイン

## 🛡️ セキュリティ

### RLS (Row Level Security)
- **tool_knowledge**: 認証済みユーザーのみ閲覧可能
- **log_summary**: 自分のデータのみアクセス可能
- 検索関数も既存のRLSポリシーを継承

### データ保護
- embedding データは暗号化保存
- OpenAI API キーは環境変数で管理
- ユーザーデータの適切な分離

## 📈 パフォーマンス

### 最適化済み
- ✅ SWR によるキャッシュ機能
- ✅ HNSW インデックスによる高速検索
- ✅ Embedding 生成の非同期処理
- ✅ フォールバック検索の実装

### 推奨設定
```typescript
// SWR設定例
const SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
};
```

## 🔄 今後の拡張可能性

1. **マルチモーダル検索** - 画像+テキスト embedding
2. **ベクトル検索の高度化** - 複数モデルの組み合わせ
3. **レコメンデーション** - 類似ナレッジの自動提案
4. **オフライン検索** - ローカル embedding キャッシュ
5. **分析ダッシュボード** - 検索パターンの分析

## 🚨 トラブルシューティング

### よくある問題

1. **Embedding生成エラー**
   ```typescript
   // OpenAI API キーを確認
   console.log(process.env.OPENAI_API_KEY ? '設定済み' : '未設定');
   ```

2. **検索結果が表示されない**
   - SQL関数が正しく作成されているか確認
   - pgvector拡張が有効化されているか確認

3. **パフォーマンス問題**
   - HNSWインデックスが作成されているか確認
   - クエリの類似度しきい値を調整

### デバッグ方法

```typescript
// 検索結果の詳細ログ
const { data, error } = useKnowledgeSearch({ query: "test" });
console.log({ data, error });

// Embedding生成のテスト
const embedding = await generateEmbedding("test text");
console.log(embedding.length); // 次元数確認
```

---

🎉 **Embedding機能の実装が完了しました！**

別プロジェクトの実装を参考に、最新のAI技術を活用した高度な検索機能をYComに追加できました。セマンティック検索により、より直感的で強力なナレッジ管理が可能になります。

何かご質問があれば、お気軽にお声かけください！ 🚀✨
