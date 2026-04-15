// @arcrouter/sdk — pay-per-call AI inference on Arc with USDC + ERC-8183
import {
  createPublicClient, createWalletClient, defineChain, http, parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ARC_LOCAL = defineChain({
  id: 1337,
  name: 'Arc Local',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['http://localhost:8545'] } },
});

const ARC_TESTNET = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
});

const ARCROUTER_ABI = [
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
  { type: 'function', name: 'jobCount', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
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
  { type: 'event', name: 'JobCreated',
    inputs: [
      { type: 'uint256', name: 'jobId', indexed: true },
      { type: 'address', name: 'client', indexed: true },
      { type: 'address', name: 'provider', indexed: true },
      { type: 'address', name: 'evaluator', indexed: false },
      { type: 'uint256', name: 'expiredAt', indexed: false },
      { type: 'address', name: 'hook', indexed: false },
    ] },
];

const DEFAULT_NETWORKS = {
  local: { chain: ARC_LOCAL, contract: '0xa6d4Dd36b251d103A2Ac25961ce4C85a0491179d', server: 'http://localhost:3402' },
  testnet: { chain: ARC_TESTNET, contract: null, server: 'https://api.arcrouter.dev' },
};

export class ArcRouter {
  /**
   * @param {object} opts
   * @param {`0x${string}`} opts.privateKey - client wallet private key
   * @param {string} [opts.network='local'] - 'local' | 'testnet'
   * @param {string} [opts.contract] - override deployed contract
   * @param {string} [opts.server] - override server URL
   * @param {string} [opts.providerAddress] - the AI provider/relay address (must match server's wallet)
   */
  constructor({ privateKey, network = 'local', contract, server, providerAddress }) {
    const cfg = DEFAULT_NETWORKS[network];
    if (!cfg) throw new Error(`unknown network: ${network}`);
    this.chain = cfg.chain;
    this.contract = contract || cfg.contract;
    this.serverUrl = server || cfg.server;
    this.providerAddress = providerAddress;
    if (!this.contract) throw new Error('contract address required');
    this.account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    this.publicClient = createPublicClient({ chain: this.chain, transport: http() });
    this.walletClient = createWalletClient({ chain: this.chain, transport: http(), account: this.account });
  }

  /**
   * One-shot inference: create job, fund, call AI server, optionally auto-complete.
   * @param {object} opts
   * @param {Array<{role:string,content:string}>} opts.messages
   * @param {string} [opts.model='auto']
   * @param {bigint|string} opts.budget - in USDC (e.g., '0.001' or 1000000000000n wei)
   * @param {boolean} [opts.autoComplete=true] - call complete() automatically after result received
   * @returns {Promise<{content:string, jobId:number, deliverable:string, txHash:string, completeTxHash?:string}>}
   */
  async chat({ messages, model = 'auto', budget = '0.002', autoComplete = true, max_tokens = 1024 }) {
    if (!this.providerAddress) throw new Error('providerAddress required for on-chain job routing');

    const budgetWei = typeof budget === 'bigint' ? budget : parseUnits(String(budget), 18);
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // 1. createJob
    const createTx = await this.walletClient.writeContract({
      address: this.contract, abi: ARCROUTER_ABI, functionName: 'createJob',
      args: [this.providerAddress, this.account.address, expiredAt, model, '0x0000000000000000000000000000000000000000'],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: createTx });
    const jobCount = await this.publicClient.readContract({
      address: this.contract, abi: ARCROUTER_ABI, functionName: 'jobCount',
    });
    const jobId = Number(jobCount - 1n);

    // 2. setBudget
    const budgetTx = await this.walletClient.writeContract({
      address: this.contract, abi: ARCROUTER_ABI, functionName: 'setBudget',
      args: [BigInt(jobId), budgetWei, '0x'],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: budgetTx });

    // 3. fund
    const fundTx = await this.walletClient.writeContract({
      address: this.contract, abi: ARCROUTER_ABI, functionName: 'fund',
      args: [BigInt(jobId), '0x'], value: budgetWei,
    });
    await this.publicClient.waitForTransactionReceipt({ hash: fundTx });

    // 4. POST to server
    const r = await fetch(`${this.serverUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, messages, model, max_tokens }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`server: ${data.error || r.status}`);

    // 5. (optional) auto-complete
    let completeTxHash;
    if (autoComplete) {
      completeTxHash = await this.walletClient.writeContract({
        address: this.contract, abi: ARCROUTER_ABI, functionName: 'complete',
        args: [BigInt(jobId), '0x0000000000000000000000000000000000000000000000000000000000000000', '0x'],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: completeTxHash });
    }

    return {
      content: data.content,
      jobId,
      deliverable: data.deliverable,
      txHash: data.txHash,
      completeTxHash,
      provider: data.provider,
      model: data.model,
      usage: data.usage,
    };
  }

  async getJob(jobId) {
    return this.publicClient.readContract({
      address: this.contract, abi: ARCROUTER_ABI, functionName: 'getJob', args: [BigInt(jobId)],
    });
  }

  async listAvailableModels() {
    const r = await fetch(`${this.serverUrl}/v1/models`);
    return r.json();
  }
}

export default ArcRouter;
