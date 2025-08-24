import { getSupabaseServiceClient } from '@/lib/supabase/server';
// Database型は現在使用していないためコメントアウト
// import { Database } from '@/lib/supabase/database.types';

// 新しいテーブル構造に合わせた型定義
type RecommendationInsert = {
  id?: string;
  content: string;
  user_id: string;
  created_at?: string | null;
};

/**
 * Supabaseのrecommendationsテーブルにユーザーアドバイスを保存する
 */
export async function saveUserAdviceRecommendation(params: {
  userAdvice: string;
  userId: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = getSupabaseServiceClient();
    
    const recommendationData: RecommendationInsert = {
      content: params.userAdvice, // ユーザーアドバイスの内容をcontentに保存
      user_id: params.userId,
      created_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('recommendations')
      .insert(recommendationData) // 型安全な挿入
      .select('id')
      .single();
    
    if (error) {
      console.error('❌ レコメンド保存エラー:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ レコメンドを保存しました:', data.id);
    return { success: true, id: data.id };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ レコメンド保存処理エラー:', message);
    return { success: false, error: message };
  }
}

/**
 * ユーザーの最新のレコメンドを取得する
 */
// 新しいテーブル構造に合わせた型定義
type RecommendationRow = {
  id: string;
  content: string | null;
  user_id: string;
  created_at: string | null;
};

export async function getLatestRecommendations(
  userId: string,
  limit: number = 10
): Promise<RecommendationRow[]> {
  try {
    const supabase = getSupabaseServiceClient();
    
    const { data, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ レコメンド取得エラー:', error);
      return [];
    }
    
    return (data || []) as RecommendationRow[]; // テーブル構造に合わせた型アサーション
    
  } catch (error) {
    console.error('❌ レコメンド取得処理エラー:', error);
    return [];
  }
}
