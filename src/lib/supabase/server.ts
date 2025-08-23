import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const globalForSupabase = globalThis as unknown as { __supabaseServerClient?: SupabaseClient };

function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`);
	}
	return value;
}

export function getSupabaseServiceClient(): SupabaseClient {
	if (!globalForSupabase.__supabaseServerClient) {
		const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
		const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
		globalForSupabase.__supabaseServerClient = createClient(url, serviceRoleKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
			global: {
				headers: {
					'x-server-info': 'ycom-webapp-server',
				},
			},
		});
	}
	return globalForSupabase.__supabaseServerClient;
}
