import { Stats } from '@/components/Stats';
import { TryIt } from '@/components/TryIt';
import { JobsFeed } from '@/components/JobsFeed';

export default function Page() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="text-center pt-6 pb-2">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Pay-per-call AI on{' '}
          <span className="bg-arc-gradient bg-clip-text text-transparent">Arc</span>
        </h1>
        <p className="text-muted mt-3 text-lg">
          The first <code className="text-accent">ERC-8183</code> agentic-commerce marketplace. Send USDC, get inference, settle on-chain.
        </p>
      </section>

      <Stats />
      <TryIt />
      <JobsFeed />

      <footer className="text-center text-xs text-muted pt-8">
        Built on Arc Network · Native USDC · ERC-8183 ACP · Open source
      </footer>
    </div>
  );
}
