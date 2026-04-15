'use client';
import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { ARCROUTER_ADDRESS, arcRouterAbi, STATUS_NAMES } from '@/lib/config';
import { formatUnits } from 'viem';

interface Job {
  id: number;
  client: string;
  provider: string;
  description: string;
  budget: bigint;
  status: number;
}

export function JobsFeed() {
  const publicClient = usePublicClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;
    const load = async () => {
      try {
        const count = await publicClient.readContract({
          address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'jobCount',
        }) as bigint;
        const N = Number(count);
        const start = Math.max(0, N - 20);
        const out: Job[] = [];
        for (let i = N - 1; i >= start; i--) {
          const j = await publicClient.readContract({
            address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'getJob', args: [BigInt(i)],
          }) as any;
          out.push({
            id: Number(j.id), client: j.client, provider: j.provider,
            description: j.description, budget: j.budget, status: Number(j.status),
          });
        }
        setJobs(out);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [publicClient]);

  return (
    <div className="arc-card max-w-3xl">
      <h2 className="text-xl font-bold mb-3">Recent jobs</h2>
      {loading ? (
        <div className="text-muted text-center py-6">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-muted text-center py-6">No jobs yet</div>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const status = STATUS_NAMES[job.status];
  const colors: Record<string, string> = {
    Open: 'bg-blue-500/20 text-blue-300',
    Funded: 'bg-yellow-500/20 text-yellow-300',
    Submitted: 'bg-purple-500/20 text-purple-300',
    Completed: 'bg-green-500/20 text-green-300',
    Rejected: 'bg-red-500/20 text-red-300',
    Expired: 'bg-gray-500/20 text-gray-300',
  };
  return (
    <div className="bg-bg/40 rounded-lg p-3 border border-border/50 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-accent text-sm">#{job.id}</span>
          <span className={`arc-pill ${colors[status] || 'bg-gray-500/20 text-gray-300'}`}>{status}</span>
          <span className="text-xs text-muted truncate">{job.description}</span>
        </div>
        <div className="text-xs text-muted mt-1 font-mono truncate">
          {short(job.client)} → {short(job.provider)}
        </div>
      </div>
      <div className="text-right text-sm font-mono whitespace-nowrap">
        {formatUnits(job.budget, 18)} <span className="text-muted text-xs">USDC</span>
      </div>
    </div>
  );
}

function short(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }
