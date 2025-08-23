#!/usr/bin/env tsx

require('dotenv').config();

import { analyzeProductivitySessions } from '../src/lib/ai/productivity-analyzer';
import type { SessionRecord } from '../src/lib/ai/productivity-analyzer';

async function debugProductivityAnalyzer() {
    try {
        console.log('🚀 Productivity Analyzer Debug');
        console.log('===============================');
        
        const sampleSessions: SessionRecord[] = [
            {
                id: 'session-1',
                startedAt: Date.now() - 3600000,
                stoppedAt: Date.now() - 1800000,
                log: [
                    { id: 'log-1', ts: Date.now() - 3000000, level: 'info', message: 'Analyzing screen...' },
                    { id: 'log-2', ts: Date.now() - 2900000, level: 'info', message: 'Analyzing screen...' },
                    { id: 'log-3', ts: Date.now() - 2800000, level: 'info', message: 'Analyzing screen...' },
                    { id: 'log-4', ts: Date.now() - 2700000, level: 'error', message: 'API rate limit exceeded' },
                    { id: 'log-5', ts: Date.now() - 2600000, level: 'error', message: 'Connection timeout' }
                ],
                tips: [
                    { id: 'tip-1', ts: Date.now() - 2500000, title: 'Try keyboard shortcuts', detail: 'Press ⌘K to open command palette' }
                ]
            }
        ];
        
        const result = await analyzeProductivitySessions(sampleSessions);
        
        console.log('✨ Analysis Result:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugProductivityAnalyzer();
