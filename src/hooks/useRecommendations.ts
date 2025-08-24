import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';

export type Recommendation = {
  id: string;
  content: string | null;
  user_id: string;
  created_at: string | null;
};

export function useRecommendations(limit: number = 10) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      setRecommendations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [user?.id, limit]);

  return {
    recommendations,
    loading,
    error,
    refetch: fetchRecommendations,
  };
}
