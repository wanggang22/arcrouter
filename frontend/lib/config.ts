import { defineChain } from 'viem';

export const arcLocal = defineChain({
  id: 1337,
  name: 'Arc Local',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['http://localhost:8545'] } },
  testnet: true,
});

export const ARCROUTER_ADDRESS = '0xa6d4Dd36b251d103A2Ac25961ce4C85a0491179d' as const;
export const PROVIDER_ADDRESS = '0x20E40d46631026891D89CA1d33a94073D561B23B' as const;
export const SERVER_URL = 'http://localhost:3402';

export const STATUS_NAMES = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'];

export const arcRouterAbi = [
  { type: 'function', name: 'jobCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'protocolBalance', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'protocolFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getJob', stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'id', type: 'uint256' }, { name: 'client', type: 'address' },
      { name: 'provider', type: 'address' }, { name: 'evaluator', type: 'address' },
      { name: 'description', type: 'string' }, { name: 'budget', type: 'uint256' },
      { name: 'expiredAt', type: 'uint256' }, { name: 'status', type: 'uint8' },
      { name: 'hook', type: 'address' }, { name: 'deliverable', type: 'bytes32' },
    ]}],
  },
  { type: 'function', name: 'createJob', stateMutability: 'nonpayable',
    inputs: [
      { type: 'address' }, { type: 'address' }, { type: 'uint256' },
      { type: 'string' }, { type: 'address' },
    ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'setBudget', stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'fund', stateMutability: 'payable',
    inputs: [{ type: 'uint256' }, { type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'complete', stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes' }], outputs: [] },
  { type: 'event', name: 'JobCreated',
    inputs: [
      { type: 'uint256', name: 'jobId', indexed: true },
      { type: 'address', name: 'client', indexed: true },
      { type: 'address', name: 'provider', indexed: true },
      { type: 'address', name: 'evaluator', indexed: false },
      { type: 'uint256', name: 'expiredAt', indexed: false },
      { type: 'address', name: 'hook', indexed: false },
    ] },
  { type: 'event', name: 'PaymentReleased',
    inputs: [
      { type: 'uint256', name: 'jobId', indexed: true },
      { type: 'address', name: 'provider', indexed: true },
      { type: 'uint256', name: 'amount', indexed: false },
    ] },
] as const;
