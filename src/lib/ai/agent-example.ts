/**
 * Agent example using Vercel AI SDK with tools
 * This demonstrates how to use generateText with system prompts and tools
 */

import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { GoogleModel } from './lm-models';
import { z } from 'zod';

// Example tool definitions
const createNoteTools = {
  createNote: tool({
    description: 'Create a new note with the given content',
    parameters: z.object({
      title: z.string().describe('Title of the note'),
      content: z.string().describe('Content of the note'),
      tags: z.array(z.string()).optional().describe('Optional tags for the note'),
    }),
  }),

  updateNote: tool({
    description: 'Update an existing note',
    parameters: z.object({
      noteId: z.string().describe('ID of the note to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content'),
      tags: z.array(z.string()).optional().describe('New tags'),
    }),
  }),

  searchNotes: tool({
    description: 'Search for notes by keyword',
    parameters: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(10).describe('Maximum number of results'),
    }),
  }),
};

// Mock implementations for the tools
async function executeCreateNote({ title, content, tags }: { title: string; content: string; tags?: string[] }) {
  console.log('Creating note:', { title, content, tags });
  return {
    success: true,
    noteId: `note-${Date.now()}`,
    message: `Note "${title}" created successfully`,
  };
}

async function executeUpdateNote({ noteId, title, content, tags }: { noteId: string; title?: string; content?: string; tags?: string[] }) {
  console.log('Updating note:', { noteId, title, content, tags });
  return {
    success: true,
    noteId,
    message: `Note ${noteId} updated successfully`,
  };
}

async function executeSearchNotes({ query, limit }: { query: string; limit?: number }) {
  console.log('Searching notes:', { query, limit });
  return {
    success: true,
    results: [
      { noteId: 'note-1', title: 'Example Note 1', excerpt: 'This is an example...' },
      { noteId: 'note-2', title: 'Example Note 2', excerpt: 'Another example...' },
    ],
  };
}

// Example agent function with tools
export async function executeAgentWithTools(
  userInput: string,
  systemPrompt: string
) {
  try {
    // Use generateText with Google Gemini model
    const result = await generateText({
      model: google(GoogleModel.GEMINI_2_0_FLASH),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userInput,
        },
      ],
      tools: createNoteTools,
      temperature: 0.7,
      onStepFinish: async ({ toolCalls, toolResults, text, finishReason }) => {
        // Process tool calls
        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            console.log(`Tool called: ${toolCall.toolName}`);
            
            // Execute the appropriate tool based on the name
            let result;
            switch (toolCall.toolName) {
              case 'createNote':
                result = await executeCreateNote(toolCall.args as any);
                break;
              case 'updateNote':
                result = await executeUpdateNote(toolCall.args as any);
                break;
              case 'searchNotes':
                result = await executeSearchNotes(toolCall.args as any);
                break;
            }
            
            if (result) {
              console.log(`Tool result:`, result);
            }
          }
        }
        
        if (text) {
          console.log(`Assistant: ${text}`);
        }
        
        console.log(`Step finish reason: ${finishReason}`);
      },
    });

    // Return the final result
    return {
      success: true,
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      usage: result.usage,
    };
  } catch (error) {
    console.error('Agent execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Example usage
async function main() {
  const systemPrompt = `You are a helpful note-taking assistant. 
You help users create, update, and search their notes.
Always be concise and helpful in your responses.`;

  const userInput = "Create a note about the meeting today with the title 'Team Standup' and mention we discussed the new feature launch";

  const result = await executeAgentWithTools(userInput, systemPrompt);
  
  if (result.success) {
    console.log('Agent response:', result.text);
    console.log('Total tokens used:', result.usage);
  } else {
    console.log('Error:', result.error);
  }
}

// Export for testing
export { createNoteTools, main };