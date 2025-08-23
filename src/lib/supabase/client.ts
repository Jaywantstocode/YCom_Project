import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Database } from './database.types';

let cachedClient: SupabaseClient<Database> | null = null;

function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`);
	}
	return value;
}

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
			},
			global: {
				headers: {
					'x-client-info': 'ycom-webapp',
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
