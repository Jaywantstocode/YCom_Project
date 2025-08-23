/**
 * Agent example using Vercel AI SDK with tools
 * This demonstrates how to use generateText with system prompts and tools
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { GoogleModel } from './lm-models';
import { z } from 'zod';

// Parameter schemas to enable safe parsing/narrowing (avoid any)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CreateNoteParamsSchema = z.object({
  title: z.string().describe('Title of the note'),
  content: z.string().describe('Content of the note'),
  tags: z.array(z.string()).optional().describe('Optional tags for the note'),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UpdateNoteParamsSchema = z.object({
  noteId: z.string().describe('ID of the note to update'),
  title: z.string().optional().describe('New title'),
  content: z.string().optional().describe('New content'),
  tags: z.array(z.string()).optional().describe('New tags'),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SearchNotesParamsSchema = z.object({
  query: z.string().describe('Search query'),
  limit: z.number().optional().default(10).describe('Maximum number of results'),
});

// Type definitions for parameter schemas
type CreateNoteParams = z.infer<typeof CreateNoteParamsSchema>;
type UpdateNoteParams = z.infer<typeof UpdateNoteParamsSchema>;
type SearchNotesParams = z.infer<typeof SearchNotesParamsSchema>;

// Example tool definitions (omitted in this example to avoid SDK tool typings)
// We still execute the corresponding functions manually in onStepFinish
const createNoteTools = {} as const;

// Mock implementations for the tools (used for demonstration)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeCreateNote({ title, content, tags }: CreateNoteParams) {
  console.log('Creating note:', { title, content, tags });
  return {
    success: true,
    noteId: `note-${Date.now()}`,
    message: `Note "${title}" created successfully`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeUpdateNote({ noteId, title, content, tags }: UpdateNoteParams) {
  console.log('Updating note:', { noteId, title, content, tags });
  return {
    success: true,
    noteId,
    message: `Note ${noteId} updated successfully`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeSearchNotes({ query, limit }: SearchNotesParams) {
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
      model: google(GoogleModel.GEMINI_2_5_PRO),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userInput,
        },
      ],
      temperature: 0.7,
      onStepFinish: async ({ text, finishReason }) => {
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