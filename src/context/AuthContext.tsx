"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { type User, type Session, type AuthError } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';
import { type Tables } from '@/lib/supabase/database.types';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'created_at'>>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return getBrowserSupabaseClient();
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      return null;
    }
  }, []);

  // Local fallback for session persistence to smooth reloads
  const LOCAL_SESSION_KEY = 'ycom.auth.session.v1';
  const saveLocalSession = (sess: Session | null) => {
    try {
      if (typeof window === 'undefined') return;
      if (sess) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sess));
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    } catch {}
  };
  const loadLocalSession = (): Session | null => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  };

  // Read Supabase SDK's own localStorage entry to recover tokens if needed
  const loadSupabaseStoredTokens = (): { access_token: string; refresh_token: string } | null => {
    try {
      if (typeof window === 'undefined') return null;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const m = url.match(/^https?:\/\/([^.]+)\./);
      const ref = m?.[1];
      if (!ref) return null;
      const key = `sb-${ref}-auth-token`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { currentSession?: { access_token?: string; refresh_token?: string } };
      const at = parsed?.currentSession?.access_token;
      const rt = parsed?.currentSession?.refresh_token;
      if (at && rt) return { access_token: at, refresh_token: rt };
      return null;
    } catch {
      return null;
    }
  };

  // プロファイルを取得する関数
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  }, [supabase]);

  // 認証状態の変化を監視
  useEffect(() => {
    if (!supabase) {
      console.log('Supabase client not available, setting loading to false');
      setLoading(false);
      return;
    }
    
    let mounted = true;

    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        console.log('Initial session:', initialSession?.user?.email || 'No session');
        
        // Fallback to locally cached session to avoid logged-out flash on reload
        let sess = initialSession ?? null;
        if (!sess) {
          // Try our own cached session first
          const cached = loadLocalSession();
          if (cached?.access_token && cached?.refresh_token) {
            try {
              const { data } = await supabase.auth.setSession({
                access_token: (cached as unknown as { access_token: string }).access_token,
                refresh_token: (cached as unknown as { refresh_token: string }).refresh_token,
              });
              if (data.session) {
                sess = data.session;
                console.log('Restored session from cache');
              }
            } catch (error) {
              console.error('Error restoring cached session:', error);
            }
          }
        }
        if (!sess) {
          // Fallback to Supabase SDK's own stored token if present
          const stored = loadSupabaseStoredTokens();
          if (stored) {
            try {
              const { data } = await supabase.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token,
              });
              if (data.session) {
                sess = data.session;
                console.log('Restored session from Supabase storage');
              }
            } catch (error) {
              console.error('Error restoring Supabase stored session:', error);
            }
          }
        }
        
        if (mounted) {
          setSession(sess);
          setUser(sess?.user ?? null);
          
          if (sess?.user) {
            console.log('Fetching profile for user:', sess.user.email);
            const userProfile = await fetchProfile(sess.user.id);
            setProfile(userProfile);
          }
          
          console.log('Initial session setup complete');
          setLoading(false);
        }
      } catch (error) {
        console.error('Unexpected error in getInitialSession:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // フェイルセーフ: 10秒後にローディングを強制的に解除
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization timed out, setting loading to false');
        setLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        saveLocalSession(session ?? null);

        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }

        // すべてのイベントでローディングを解除
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } as AuthError };
    }
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return { error: result.error };
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } as AuthError };
    }
    setLoading(true);
    const result = await supabase.auth.signUp({ email, password });
    setLoading(false);
    return { error: result.error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } as AuthError };
    }
    setLoading(true);
    const result = await supabase.auth.signOut();
    setLoading(false);
    return { error: result.error };
  }, [supabase]);

  const updateProfile = useCallback(async (updates: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
    if (!user || !supabase) {
      return { error: new Error('No user logged in or Supabase client not available') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { error: new Error(error.message) };
      }

      setProfile(data);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [supabase, user]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
