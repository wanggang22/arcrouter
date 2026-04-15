'use client';
import { useState } from 'react';
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi';
import { ARCROUTER_ADDRESS, PROVIDER_ADDRESS, SERVER_URL, arcRouterAbi } from '@/lib/config';
import { parseUnits, formatUnits } from 'viem';

const MODELS = [
  { value: 'claude-haiku', label: 'Claude Haiku 4.5 (~0.001 USDC)' },
  { value: 'claude-sonnet', label: 'Claude Sonnet 4.5 (~0.005 USDC)' },
  { value: 'auto', label: 'Auto (cheapest available)' },
];

export function TryIt() {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [prompt, setPrompt] = useState('Explain ERC-8183 in one sentence.');
  const [model, setModel] = useState('claude-haiku');
  const [budget, setBudget] = useState('0.002');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const runJob = async () => {
    if (!walletClient || !address || !publicClient) return;
    setRunning(true); setError(''); setResult(null);
    try {
      const budgetWei = parseUnits(budget, 18);
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

      setStep('1/5 createJob...');
      const tx1 = await walletClient.writeContract({
        address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'createJob',
        args: [PROVIDER_ADDRESS, address, expiredAt, model, '0x0000000000000000000000000000000000000000'],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      const jobCount = await publicClient.readContract({
        address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'jobCount',
      });
      const jobId = Number(jobCount - 1n);

      setStep(`2/5 setBudget (job ${jobId})...`);
      const tx2 = await walletClient.writeContract({
        address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'setBudget',
        args: [BigInt(jobId), budgetWei, '0x'],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx2 });

      setStep('3/5 fund...');
      const tx3 = await walletClient.writeContract({
        address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'fund',
        args: [BigInt(jobId), '0x'], value: budgetWei,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx3 });

      setStep('4/5 calling AI...');
      const r = await fetch(`${SERVER_URL}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'inference failed');

      setStep('5/5 complete (release payment)...');
      const tx5 = await walletClient.writeContract({
        address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'complete',
        args: [BigInt(jobId), '0x0000000000000000000000000000000000000000000000000000000000000000', '0x'],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx5 });

      setStep('done');
      setResult({ ...data, jobId, completeTx: tx5 });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setRunning(false); }
  };

  return (
    <div className="arc-card max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Try ArcRouter</h2>
        <div className="text-xs text-muted">
          Balance: {bal ? Number(formatUnits(bal.value, 18)).toFixed(4) : '–'} USDC
        </div>
      </div>

      <label className="text-xs text-muted">Prompt</label>
      <textarea className="arc-input mt-1 h-24 resize-y" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} />

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-muted">Model</label>
          <select className="arc-input mt-1" value={model} onChange={(e) => setModel(e.target.value)} disabled={running}>
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">Budget (USDC)</label>
          <input type="text" className="arc-input mt-1" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))} disabled={running} />
        </div>
      </div>

      <button
        onClick={runJob} disabled={!address || running}
        className={!address ? 'arc-btn bg-border text-muted cursor-not-allowed mt-4 w-full' : 'arc-btn-primary mt-4 w-full'}
      >
        {!address ? 'Connect wallet first' : running ? `Running... ${step}` : 'Run job (5 on-chain txs)'}
      </button>

      {error && <div className="mt-3 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-200 text-sm">Error: {error}</div>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="arc-card bg-bg/40">
            <div className="text-xs text-muted mb-1">AI Response (verified on-chain)</div>
            <div className="text-white whitespace-pre-wrap">{result.content}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Job ID" value={`#${result.jobId}`} />
            <Field label="Provider" value={result.provider} />
            <Field label="Model" value={result.model} />
            <Field label="Tokens" value={`${result.usage?.input_tokens ?? '?'}→${result.usage?.output_tokens ?? '?'}`} />
            <Field label="Deliverable hash" value={result.deliverable} mono />
            <Field label="Submit tx" value={result.txHash} mono />
            <Field label="Complete tx" value={result.completeTx} mono />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-bg/40 rounded-lg p-2 border border-border/50">
      <div className="text-muted">{label}</div>
      <div className={`text-white truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</div>
    </div>
  );
}
