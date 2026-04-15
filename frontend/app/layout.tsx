import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'ArcRouter — AI inference on Arc',
  description: 'The first ERC-8183 compatible AI inference marketplace on Arc Network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-white min-h-screen antialiased font-sans">
        <Providers>
          <div className="min-h-screen bg-arc-glow">
            <Header />
            <main className="px-4 pt-8 pb-20">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
