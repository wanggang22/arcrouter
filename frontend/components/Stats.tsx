'use client';
import { useReadContracts } from 'wagmi';
import { ARCROUTER_ADDRESS, arcRouterAbi } from '@/lib/config';
import { formatUnits } from 'viem';

export function Stats() {
  const { data } = useReadContracts({
    contracts: [
      { address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'jobCount' },
      { address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'protocolBalance' },
      { address: ARCROUTER_ADDRESS, abi: arcRouterAbi, functionName: 'protocolFeeBps' },
    ],
    query: { refetchInterval: 4000 },
  });
  const total = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const fees = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const fee = (data?.[2]?.result as bigint | undefined) ?? 0n;
  return (
    <div className="grid grid-cols-3 gap-4 max-w-3xl">
      <Stat label="Total jobs" value={total.toString()} />
      <Stat label="Protocol fees" value={`${formatUnits(fees, 18)} USDC`} />
      <Stat label="Fee rate" value={`${(Number(fee) / 100).toFixed(2)}%`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="arc-card">
      <div className="text-muted text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1 truncate">{value}</div>
    </div>
  );
}
