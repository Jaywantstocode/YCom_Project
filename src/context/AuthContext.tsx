"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;

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
      setLoading(false);
      return;
    }
    
    let mounted = true;

    const getInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (mounted) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          const userProfile = await fetchProfile(initialSession.user.id);
          setProfile(userProfile);
        }
        
        setLoading(false);
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }

        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
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
