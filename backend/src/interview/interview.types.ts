// src/interview/interview.types.ts

export type OpenAIRole = 'system' | 'user' | 'assistant';

export interface OpenAIMessage {
  role: OpenAIRole;
  content: string;
}

export interface InterviewAIResponse {
  reply: string;
  feedback: string | null;
}
