export interface Message {
  thread_id: string;
  role: 'model' | 'human' | 'system';
  name?: string;
  text: string;
  color?: string;
  round?: string;
  typing?: boolean;
  done?: boolean;
  recap?: string;
  confidence?: number;
  assumptions?: string[];
  phase?: 'blind_draft' | 'consensus_check' | 'targeted_debate' | 'synthesizing' | string;
  isConsensus?: 'unanimous' | 'additive' | 'divergent' | null;
  recommendation?: string;
  keyCaveat?: string;
  agentPayload?: any;
}

export interface Thread {
  id: string;
  topic: string;
  status: 'active' | 'complete' | 'saved';
  source: 'live' | 'file';
  created: string;
  isProtocol?: boolean;
  stakes?: 'low' | 'medium' | 'high';
  reversible?: boolean;
}

export const MODELS = {
  // Deep Research / Reasoning Models (Slow but thorough)
  'o3-Pro': { id: 'o3', color: '#ef4444', tier: 'best', description: 'OpenAI reasoning specialist. Best for complex math, logic puzzles, and deep planning.' },
  'DeepSeek R1': { id: 'deepseek', color: '#fb923c', tier: 'best', description: 'DeepSeek reasoning model. Best for complex logic and step-by-step thinking.' },
  
  // Standard Flagship Models (Smart but fast - ~30s)
  'Claude Opus 4.6': { id: 'claude', color: '#5b9bf5', tier: 'fast', description: 'Anthropic flagship. Best for coding, writing, and nuanced reasoning.' },
  'Gemini 3.1 Pro': { id: 'gemini', color: '#34d399', tier: 'fast', description: 'Google advanced engine. Best for massive context, multimodal, and search.' },
  'GPT-5.4 Pro': { id: 'gpt5', color: '#a78bfa', tier: 'fast', description: 'OpenAI frontier model. Best for general logic and structured data.' },

  // Lightweight Models (Lightning fast)
  'Claude 3.5 Haiku': { id: 'haiku', color: '#60a5fa', tier: 'light', description: 'Anthropic fast model. Best for high-speed, low-cost tasks.' },
  'Gemini 3.1 Flash': { id: 'flash', color: '#10b981', tier: 'light', description: 'Google fast model. Best for quick multimodal processing.' },
  'GPT-4o-mini': { id: 'gpt4o-mini', color: '#c084fc', tier: 'light', description: 'OpenAI fast model. Best for quick general tasks.' },
  'Llama 3.3 70B': { id: 'llama', color: '#facc15', tier: 'light', description: 'Meta open-source model. Best for fast, uncensored generation.' },
} as const;

export type ModelKey = keyof typeof MODELS;
