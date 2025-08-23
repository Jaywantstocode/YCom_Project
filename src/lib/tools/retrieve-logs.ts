/**
 * Tool for retrieving session logs from Supabase
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tool definition
export const retrieveSessionLogs = {
  description: 'Retrieve session logs from the database',
  parameters: z.object({
    sessionId: z.string().optional().describe('Specific session ID to retrieve'),
    limit: z.number().optional().default(100).describe('Maximum number of logs to retrieve'),
  }),
  execute: async ({ sessionId, limit }: { sessionId?: string; limit?: number }) => {
    try {
      console.log('Retrieving session logs from Supabase:', { sessionId, limit });
      
      // Build the query
      let query = supabase
        .from('session_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 100);
      
      // Add session filter if provided
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error retrieving logs:', error);
        return {
          success: false,
          logs: [],
          message: `Error retrieving logs: ${error.message}`
        };
      }
      
      return {
        success: true,
        logs: data || [],
        message: `Retrieved ${data?.length || 0} logs`
      };
    } catch (error) {
      console.error('Error in retrieveSessionLogs:', error);
      return {
        success: false,
        logs: [],
        message: `Failed to retrieve logs: ${error}`
      };
    }
  },
};