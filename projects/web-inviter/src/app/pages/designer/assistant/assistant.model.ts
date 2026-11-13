/** The designer assistant's API shapes (`/api/designs/{id}/assistant`). */

export interface AssistantStatus {
  allowed: boolean;
  /** addon (on Premium without the AI designer) | premium (anyone else not entitled) | allowance | unavailable, when not allowed. */
  reason: 'addon' | 'premium' | 'allowance' | 'unavailable' | null;
  usedUsd: number;
  allowanceUsd: number;
  resetsAt: string;
}

/** One chat entry: what the person wrote, the assistant's reply, or the lines its tools reported. */
export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'results';
  text: string;
  lines: string[];
  startsTurn: boolean;
  createdAt: string;
}

export interface AssistantToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AssistantChat {
  messages: AssistantMessage[];
  status: AssistantStatus;
  pendingToolCalls: AssistantToolCall[];
}

export interface AssistantStep {
  messages: AssistantMessage[];
  toolCalls: AssistantToolCall[];
  done: boolean;
  status: AssistantStatus;
}

export interface AssistantVocabulary {
  moves: { id: string; label: string }[];
  stickers: { id: string; label: string }[];
}
