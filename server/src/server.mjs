// ArcRouter server: receives chat requests + on-chain Job ref, routes to AI provider, submits result on-chain
import express from 'express';
import cors from 'cors';
import { keccak256, toHex, stringToHex } from 'viem';
import {
  ARCROUTER, ARCROUTER_ABI, PRICING, STATUS_NAMES,
  publicClient, walletClient, providerAccount,
} from './config.mjs';
import { chat, listAvailable, resolveModel } from './providers.mjs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3402;

// Result cache: jobId → { content, deliverable, submittedAt }
const resultCache = new Map();

app.get('/v1/health', (req, res) => {
  res.json({
    ok: true,
    provider: providerAccount.address,
    contract: ARCROUTER,
    available: listAvailable(),
    pricing: Object.fromEntries(Object.entries(PRICING).map(([k, v]) => [k, v.toString()])),
  });
});

app.get('/v1/models', (req, res) => {
  const avail = listAvailable();
  res.json({
    models: Object.keys(PRICING).filter((k) => k === 'auto' || avail[k]),
    pricing_usdc_wei: Object.fromEntries(Object.entries(PRICING).map(([k, v]) => [k, v.toString()])),
  });
});

/**
 * Main inference endpoint.
 * Body: { jobId: number, messages: [...], model?: string, max_tokens?: number }
 * Returns: { content, deliverable, txHash, jobId }
 *
 * Pre-conditions:
 *  - Client created Job on-chain with provider == this server's address
 *  - Job is in Funded status
 *  - Budget >= price for requested model
 */
app.post('/v1/chat/completions', async (req, res) => {
  const { jobId, messages, model = 'auto', max_tokens = 1024 } = req.body || {};
  if (jobId === undefined || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'missing jobId or messages' });
  }

  // 1. Verify job on-chain
  let job;
  try {
    job = await publicClient.readContract({
      address: ARCROUTER, abi: ARCROUTER_ABI, functionName: 'getJob', args: [BigInt(jobId)],
    });
  } catch (e) {
    return res.status(404).json({ error: 'job not found', detail: e.message });
  }

  const status = STATUS_NAMES[Number(job.status)];
  if (status !== 'Funded') {
    return res.status(400).json({ error: `job status is ${status}, expected Funded` });
  }
  if (job.provider.toLowerCase() !== providerAccount.address.toLowerCase()) {
    return res.status(403).json({ error: 'this job is for a different provider', expected: providerAccount.address, got: job.provider });
  }
  const price = PRICING[model] ?? PRICING['auto'];
  if (job.budget < price) {
    return res.status(402).json({ error: 'budget too low', required_wei: price.toString(), got_wei: job.budget.toString() });
  }

  // 2. Cache hit?
  if (resultCache.has(jobId)) {
    return res.json(resultCache.get(jobId));
  }

  // 3. Run inference
  let result;
  try {
    result = await chat({ messages, model, max_tokens });
  } catch (e) {
    return res.status(502).json({ error: 'inference failed', detail: e.message });
  }

  // 4. Hash result for on-chain commitment
  const deliverable = keccak256(toHex(result.content));

  // 5. Submit on-chain
  let txHash;
  try {
    txHash = await walletClient.writeContract({
      address: ARCROUTER, abi: ARCROUTER_ABI, functionName: 'submit',
      args: [BigInt(jobId), deliverable, '0x'],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (e) {
    return res.status(500).json({ error: 'on-chain submit failed', detail: e.message });
  }

  const payload = {
    jobId,
    content: result.content,
    deliverable,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    txHash,
    nextStep: 'evaluator should call complete(jobId) to release payment',
  };
  resultCache.set(jobId, payload);
  res.json(payload);
});

/**
 * Get result for a job (idempotent, useful after chain confirmation)
 */
app.get('/v1/jobs/:id/result', async (req, res) => {
  const jobId = Number(req.params.id);
  if (!resultCache.has(jobId)) {
    return res.status(404).json({ error: 'no cached result; submit first via /v1/chat/completions' });
  }
  res.json(resultCache.get(jobId));
});

app.listen(PORT, () => {
  console.log(`ArcRouter server :${PORT}`);
  console.log(`  contract:  ${ARCROUTER}`);
  console.log(`  provider:  ${providerAccount.address}`);
  console.log(`  available: ${JSON.stringify(listAvailable())}`);
});
