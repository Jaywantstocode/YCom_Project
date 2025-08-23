/**
 * AI productivity analyzer with tools
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { PRODUCTIVITY_AGENT_PROMPT } from './prompts';
import { GoogleModel } from './lm-models';
import { productivityTools } from '../tools';

// Session data (from SessionContext)
export interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
}

export interface AgentLogItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AgentTip {
  id: string;
  ts: number;
  title: string;
  detail?: string;
}

// Analysis result interface
export interface ProductivityAnalysis {
  success: boolean;
  analysis: string;
  toolCalls?: any[];
  error?: string;
}

/**
 * Analyze sessions using generateText with tools
 */
export async function analyzeProductivitySessions(sessions: SessionRecord[]): Promise<ProductivityAnalysis> {
  try {
    const sessionData = formatSessions(sessions);
    
    console.log('🤖 Analyzing productivity with tools');
    
    // Use generateText with tools
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_0_FLASH),
      messages: [
        {
          role: 'system',
          content: PRODUCTIVITY_AGENT_PROMPT
        },
        {
          role: 'user',
          content: `Analyze the following session data and provide productivity recommendations:

${sessionData}

Use the available tools to retrieve additional logs, search for patterns, or find relevant products on Product Hunt that might help improve productivity.`
        }
      ],
      tools: productivityTools,
      temperature: 0.7,
    });

    console.log('🔧 Tool calls made:', result.toolCalls?.length || 0);
    console.log('📝 Analysis complete');
    
    return {
      success: true,
      analysis: result.text,
      toolCalls: result.toolCalls,
    };

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return {
      success: false,
      analysis: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function formatSessions(sessions: SessionRecord[]): string {
  return sessions.map(session => {
    const duration = session.stoppedAt ? 
      Math.round((session.stoppedAt - session.startedAt) / 60000) : 
      'ongoing';
    
    return `Session ID: ${session.id}
Duration: ${duration} minutes
Logs: ${session.log.length} entries
Tips: ${session.tips.length} entries
Recent logs: ${session.log.slice(-5).map(log => `[${log.level}] ${log.message}`).join(', ')}`;
  }).join('\n\n');
}