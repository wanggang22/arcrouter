// SDK end-to-end test
import { ArcRouter } from './src/index.js';
import fs from 'node:fs';

// Read client key from arc-accounts/account6/.env
const envText = fs.readFileSync('C:/Users/ASUS/arc-accounts/account6/.env', 'utf8');
const PRIVATE_KEY = envText.match(/^PRIVATE_KEY=(.+)$/m)[1].trim();

const PROVIDER_ADDRESS = '0x20E40d46631026891D89CA1d33a94073D561B23B';

const router = new ArcRouter({
  privateKey: PRIVATE_KEY,
  network: 'local',
  providerAddress: PROVIDER_ADDRESS,
});

console.log('Available models:', await router.listAvailableModels());

console.log('\n--- Sending chat request ---');
const result = await router.chat({
  messages: [{ role: 'user', content: 'In one sentence: what is ERC-8183?' }],
  model: 'claude-haiku',
  budget: '0.001',
  autoComplete: true,
});

console.log('\n=== RESULT ===');
console.log('Job:', result.jobId);
console.log('Content:', result.content);
console.log('Deliverable:', result.deliverable);
console.log('Submit tx:', result.txHash);
console.log('Complete tx:', result.completeTxHash);
console.log('Tokens:', result.usage);
