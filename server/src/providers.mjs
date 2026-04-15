import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL_MAP = {
  'claude-haiku': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'claude-opus': { provider: 'anthropic', model: 'claude-opus-4-6' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
};

export function listAvailable() {
  const out = {};
  for (const [k, v] of Object.entries(MODEL_MAP)) {
    out[k] = Boolean((v.provider === 'anthropic' && anthropic) || (v.provider === 'openai' && openai));
  }
  return out;
}

/// Smart routing: pick cheapest available for "auto"
export function resolveModel(requested) {
  if (requested === 'auto') {
    if (anthropic) return MODEL_MAP['claude-haiku'];
    if (openai) return MODEL_MAP['gpt-4o-mini'];
    throw new Error('no AI provider configured');
  }
  const mapped = MODEL_MAP[requested];
  if (!mapped) throw new Error(`unknown model: ${requested}`);
  if (mapped.provider === 'anthropic' && !anthropic) throw new Error('Anthropic not configured');
  if (mapped.provider === 'openai' && !openai) throw new Error('OpenAI not configured');
  return mapped;
}

export async function chat({ messages, model, max_tokens = 1024 }) {
  const m = resolveModel(model);
  if (m.provider === 'anthropic') {
    const sys = messages.find((x) => x.role === 'system')?.content;
    const nonSys = messages.filter((x) => x.role !== 'system');
    const r = await anthropic.messages.create({
      model: m.model,
      max_tokens,
      ...(sys ? { system: sys } : {}),
      messages: nonSys,
    });
    return {
      provider: 'anthropic', model: m.model,
      content: r.content[0].type === 'text' ? r.content[0].text : '',
      usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens },
    };
  } else {
    const r = await openai.chat.completions.create({
      model: m.model, messages, max_tokens,
    });
    return {
      provider: 'openai', model: m.model,
      content: r.choices[0].message.content,
      usage: { input_tokens: r.usage.prompt_tokens, output_tokens: r.usage.completion_tokens },
    };
  }
}
