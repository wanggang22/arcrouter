'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-arc-gradient" />
        <span className="font-bold text-lg tracking-tight">
          Arc<span className="text-accent">Router</span>
        </span>
        <span className="text-xs text-muted hidden sm:block">AI inference on Arc · ERC-8183</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="https://github.com/wanggang22" className="text-muted hover:text-white text-sm">GitHub</Link>
        <ConnectButton accountStatus="address" chainStatus="icon" />
      </div>
    </header>
  );
}
