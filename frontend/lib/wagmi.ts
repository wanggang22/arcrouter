'use client';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arcLocal } from './config';

export const wagmiConfig = getDefaultConfig({
  appName: 'ArcRouter',
  projectId: '00000000000000000000000000000000',
  chains: [arcLocal],
  ssr: true,
});
