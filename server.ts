import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory store for threads
const threads = new Map();
const clients = new Map();

// Generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Mock prices per 1k tokens (input + output avg)
const MODEL_PRICES: Record<string, number> = {
  'claude': 0.015,
  'gemini': 0.007,
  'gpt5': 0.010,
  'o3': 0.015,
  'deepseek': 0.002,
  'haiku': 0.00025,
  'flash': 0.0001,
  'gpt4o-mini': 0.00015,
  'llama': 0.0004
};

const OPENROUTER_MODELS: Record<string, string> = {
  'claude': 'anthropic/claude-3-opus',
  'gemini': 'google/gemini-pro-1.5',
  'gpt5': 'openai/gpt-4o',
  'o3': 'openai/o3-mini',
  'deepseek': 'deepseek/deepseek-r1',
  'haiku': 'anthropic/claude-3-haiku',
  'flash': 'google/gemini-flash-1.5',
  'gpt4o-mini': 'openai/gpt-4o-mini',
  'llama': 'meta-llama/llama-3-70b-instruct'
};

app.post('/start', (req, res) => {
  const thread_id = generateId();
  threads.set(thread_id, { ...req.body, id: thread_id, status: 'active', created: new Date().toISOString(), messages: [] });
  res.json({ thread_id });
  
  setTimeout(() => simulateClarification(thread_id, req.body.models || ['claude', 'gemini', 'gpt5'], req.body.topic), 1000);
});

app.post('/api/ask', (req, res) => {
  const thread_id = generateId();
  threads.set(thread_id, { ...req.body, topic: req.body.question, id: thread_id, status: 'active', created: new Date().toISOString(), messages: [] });
  res.json({ thread_id });
  
  setTimeout(() => simulateClarification(thread_id, req.body.models, req.body.question), 1000);
});

app.get('/threads', (req, res) => {
  res.json(Array.from(threads.values()).map(t => ({
    id: t.id,
    topic: t.topic || t.question || 'Untitled Debate',
    status: t.status,
    created: t.created,
    stakes: t.stakes,
    reversible: t.reversible
  })));
});

app.post('/human', (req, res) => {
  const thread = threads.get(req.body.thread_id);
  if (thread) {
    thread.messages.push({ role: 'human', text: req.body.text });
    if (thread.status === 'awaiting_input') {
      thread.status = 'active';
      setTimeout(() => simulateDebate(thread.id, thread.models || ['claude', 'gemini', 'gpt5'], thread.topic + "\n\nUser clarification: " + req.body.text), 1000);
    } else {
      // If already active, just simulate a quick response
      setTimeout(() => simulateDebate(thread.id, req.body.models || ['claude'], req.body.text), 1000);
    }
  }
  res.json({ success: true });
});

app.post('/save/:threadId', (req, res) => {
  const thread = threads.get(req.params.threadId);
  if (thread) thread.status = 'saved';
  res.json({ success: true });
});

app.get('/stream/:threadId', (req, res) => {
  const threadId = req.params.threadId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients.set(threadId, res);

  req.on('close', () => {
    clients.delete(threadId);
  });
});

function sendEvent(threadId: string, data: any) {
  const res = clients.get(threadId);
  if (res) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

async function callOpenRouter(modelId: string, prompt: string): Promise<{ text: string, cost: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Fallback to mock if no API key
    return { text: `Mock response from ${modelId} based on first principles.`, cost: (MODEL_PRICES[modelId] || 0.005) * 2 };
  }

  try {
    const orModel = OPENROUTER_MODELS[modelId] || 'openai/gpt-4o-mini';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Town Hall'
      },
      body: JSON.stringify({
        model: orModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "No response generated.";
    
    // OpenRouter sometimes includes cost in the response, or we can calculate it
    // For simplicity, we'll use our mock prices multiplied by usage if available, or just a mock cost
    const usage = data.usage?.total_tokens || 500;
    const cost = (usage / 1000) * (MODEL_PRICES[modelId] || 0.005);

    return { text, cost };
  } catch (err) {
    console.error("OpenRouter API error:", err);
    return { text: `Error calling ${modelId}.`, cost: 0 };
  }
}

async function simulateClarification(threadId: string, models: string[], topic: string) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  if (!models || models.length === 0) models = ['claude', 'gemini', 'gpt5'];
  
  sendEvent(threadId, { type: 'status', phase: 'clarification' });
  await delay(1000);
  
  const leadModel = models[0];
  sendEvent(threadId, { type: 'message', role: 'model', name: leadModel, text: `Reviewing topic for missing context... `, done: false });
  
  const prompt = `You are the lead orchestrator of an AI council. The user wants us to debate and decide on the following topic:
"${topic}"

Before we begin the debate, ask 1 or 2 highly critical clarifying questions that we need the user to answer to ensure our debate is grounded in their specific reality. Be concise.`;

  const { text, cost } = await callOpenRouter(leadModel, prompt);
  
  sendEvent(threadId, { type: 'message', role: 'model', name: leadModel, text, done: true });
  
  // Update thread status to wait for user input
  const thread = threads.get(threadId);
  if (thread) {
    thread.status = 'awaiting_input';
    thread.topic = topic; // Store original topic
    thread.models = models; // Store selected models
  }
  
  sendEvent(threadId, { type: 'status', phase: 'awaiting_input' });
}

async function simulateDebate(threadId: string, models: string[], topic: string) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  if (!models || models.length === 0) models = ['claude', 'gemini', 'gpt5'];
  
  let totalCost = 0;

  // Phase 1: Blind Draft
  sendEvent(threadId, { type: 'status', phase: 'blind_draft' });
  await delay(1000);
  
  const drafts = [];
  for (const model of models) {
    sendEvent(threadId, { type: 'message', role: 'model', name: model, text: `Analyzing... `, done: false });
    
    const { text, cost } = await callOpenRouter(model, `Analyze this topic from first principles: ${topic}`);
    totalCost += cost;
    drafts.push(text);

    sendEvent(threadId, { type: 'message', role: 'model', name: model, text, done: true });
    await delay(500);
  }

  // Phase 2: Targeted Debate
  sendEvent(threadId, { type: 'status', phase: 'targeted_debate' });
  await delay(1000);
  
  if (models.length > 1) {
    sendEvent(threadId, { type: 'message', role: 'model', name: models[0], text: `Reviewing other drafts... `, done: false });
    
    const { text, cost } = await callOpenRouter(models[0], `Review this draft and point out flaws: ${drafts[1] || drafts[0]}`);
    totalCost += cost;

    sendEvent(threadId, { type: 'message', role: 'model', name: models[0], text, done: true });
    await delay(1000);
  }

  // Phase 3: Synthesis
  sendEvent(threadId, { type: 'status', phase: 'synthesizing' });
  await delay(2000);
  
  const { text: synthesisText, cost: synthesisCost } = await callOpenRouter('gpt4o-mini', `Synthesize these drafts into a final recommendation: ${drafts.join('\n\n')}`);
  totalCost += synthesisCost;

  sendEvent(threadId, { 
    type: 'recap', 
    text: synthesisText.substring(0, 200) + "...",
    confidence: 88,
    isConsensus: "additive",
    recommendation: "Proceed with the synthesized strategy.",
    keyCaveat: "Requires strict monitoring.",
    nextStep: "Draft the technical spec.",
    estimatedCost: totalCost
  });
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
