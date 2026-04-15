import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
dotenv.config();

export const ARC_RPC = process.env.ARC_RPC || 'http://localhost:8545';
export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID || 1337);
export const ARCROUTER = process.env.ARCROUTER_CONTRACT;

if (!ARCROUTER) throw new Error('ARCROUTER_CONTRACT not set');

const arc = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
});

export const publicClient = createPublicClient({ chain: arc, transport: http() });

const pk = process.env.PROVIDER_PRIVATE_KEY;
if (!pk) throw new Error('PROVIDER_PRIVATE_KEY not set');
export const providerAccount = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
export const walletClient = createWalletClient({ chain: arc, transport: http(), account: providerAccount });

export const ARCROUTER_ABI = [
  {
    type: 'function', name: 'getJob', stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'client', type: 'address' },
        { name: 'provider', type: 'address' },
        { name: 'evaluator', type: 'address' },
        { name: 'description', type: 'string' },
        { name: 'budget', type: 'uint256' },
        { name: 'expiredAt', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'hook', type: 'address' },
        { name: 'deliverable', type: 'bytes32' },
      ],
    }],
  },
  {
    type: 'function', name: 'submit', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'deliverable', type: 'bytes32' }, { name: 'optParams', type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function', name: 'complete', stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'reason', type: 'bytes32' }, { name: 'optParams', type: 'bytes' }],
    outputs: [],
  },
];

export const STATUS_NAMES = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'];

// Pricing (USDC wei per request, Arc 18 decimals)
export const PRICING = {
  'claude-haiku': 1_000_000_000_000n,        // 0.001 USDC
  'claude-sonnet': 5_000_000_000_000n,       // 0.005 USDC
  'gpt-4o-mini': 1_000_000_000_000n,
  'gpt-4o': 8_000_000_000_000n,
  'auto': 2_000_000_000_000n,
};
