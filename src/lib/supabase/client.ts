import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`);
	}
	return value;
}

export function getBrowserSupabaseClient(): SupabaseClient {
	if (typeof window === 'undefined') {
		throw new Error('getBrowserSupabaseClient must be called on the client');
	}
	if (!cachedClient) {
		const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
		const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
		cachedClient = createClient(url, anonKey, {
			global: {
				headers: {
					'x-client-info': 'ycom-webapp',
				},
			},
		});
	}
	return cachedClient;
}
