import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Database } from './database.types';

let cachedClient: SupabaseClient<Database> | null = null;

export function getBrowserSupabaseClient(): SupabaseClient<Database> {
	if (typeof window === 'undefined') {
		throw new Error('getBrowserSupabaseClient must be called on the client');
	}
	if (!cachedClient) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!url) {
			throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
		}
		if (!anonKey) {
			throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
		}
		cachedClient = createClient<Database>(url, anonKey, {
			auth: {
				autoRefreshToken: true,
				persistSession: true,
				detectSessionInUrl: true,
				storage: {
					getItem: (key: string) => {
						if (typeof window !== 'undefined') {
							return window.localStorage.getItem(key);
						}
						return null;
					},
					setItem: (key: string, value: string) => {
						if (typeof window !== 'undefined') {
							window.localStorage.setItem(key, value);
						}
					},
					removeItem: (key: string) => {
						if (typeof window !== 'undefined') {
							window.localStorage.removeItem(key);
						}
					},
				},
				storageKey: 'ycom-auth-token', // カスタムストレージキー
				flowType: 'pkce', // PKCE フローを使用してセキュリティを向上
			},
			global: {
				headers: {
					'x-client-info': 'ycom-webapp',
				},
				fetch: (url, options = {}) => {
					// タイムアウトを設定
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 5000); // 5秒のタイムアウト
					
					return fetch(url, {
						...options,
						signal: controller.signal,
					}).finally(() => clearTimeout(timeout));
				},
			},
			db: {
				schema: 'public',
			},
			realtime: {
				params: {
					eventsPerSecond: 10,
				},
			},
		});
	}
	return cachedClient;
}

// 認証状態が変わった時にクライアントをリセット
export function resetSupabaseClient() {
	cachedClient = null;
}
