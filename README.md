# ArcRouter

**The first ERC-8183 compatible AI inference marketplace on Arc Network.**

Pay-per-call AI inference, settled on-chain in USDC. Each request creates a Job, escrows USDC, routes to an AI provider (Anthropic / OpenAI / Google), commits the result hash on-chain, and releases payment when the evaluator approves.

```
Client (AI agent)         ArcRouter.sol            AI Provider (this server)
       │                        │                          │
       │── createJob ──────────>│                          │
       │── setBudget ──────────>│                          │
       │── fund (USDC) ────────>│ ◀── escrow held          │
       │                        │                          │
       │── POST /chat ────────────────────────────────────>│ runs Anthropic / OpenAI
       │                        │ <── submit(deliverable) ─│
       │                        │                          │
       │── complete ───────────>│ ── pays provider ───────>│
       │ <── result + on-chain proof ─────────────────────│
```

## Why Arc

- **USDC-native gas** — `msg.value` IS USDC; no approve, no wrapping
- **Sub-second finality** — agent loops at internet speed
- **ERC-8183 ACP standard** — Arc's official agentic-commerce protocol
- **Open, verifiable** — every inference has an on-chain hash + payment receipt
- **Future**: USYC-collateralized agent wallets (idle USDC earns 4-5% via Circle's USYC)

## Live deployments

| Network | Chain ID | Contract |
|---------|----------|----------|
| Arc Testnet (public) | 5042002 | [`0xbECBE8802b38bA147D44E3C507912500D2263c2D`](https://explorer.testnet.arc.network/address/0xbECBE8802b38bA147D44E3C507912500D2263c2D) |
| Arc Local (Quake) | 1337 | `0xa6d4Dd36b251d103A2Ac25961ce4C85a0491179d` |

## Repo structure

```
arcrouter/
├── contracts/        Foundry project — ArcRouter.sol (ERC-8183 ACP)
├── server/           Express server — listens for jobs, routes to AI providers
├── sdk/js/           @arcrouter/sdk — one-call client for AI agents
├── frontend/         Next.js dashboard — try-it form, jobs feed, stats
└── README.md
```

## Quick start

### 1. Deploy the contract

```bash
cd contracts
forge create src/ArcRouter.sol:ArcRouter \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args 50  # 0.5% protocol fee
```

### 2. Run the server

```bash
cd server
cp ../.env.example ../.env  # set PROVIDER_PRIVATE_KEY + ANTHROPIC_API_KEY
npm install
node --env-file=../.env src/server.mjs
# → listens on :3402
```

### 3. Use the SDK

```javascript
import { ArcRouter } from '@arcrouter/sdk';

const router = new ArcRouter({
  privateKey: process.env.PRIVATE_KEY,
  network: 'testnet',  // or 'local'
  providerAddress: '0x20E40d46631026891D89CA1d33a94073D561B23B',
});

const result = await router.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'claude-haiku',
  budget: '0.001',  // USDC
});

console.log(result.content);     // "Hi! How can I help you?"
console.log(result.deliverable); // 0x... (keccak256 of response, on-chain)
console.log(result.txHash);      // submit tx
console.log(result.completeTxHash); // payment release tx
```

### 4. Run the dashboard

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3403
```

## Lifecycle (ERC-8183)

```
Open ──> Funded ──> Submitted ──> Completed ✓
   ↓        ↓            ↓
Rejected  Rejected   Rejected
            ↓            ↓
         Expired     Expired (refund)
```

| Role | Powers |
|------|--------|
| **Client** | Creates job, sets budget, funds escrow, can reject while Open. Receives refund on Reject/Expire |
| **Provider** | Submits work (deliverable hash). Receives payment on Complete |
| **Evaluator** | Sole authority to Complete or Reject after Submitted (often = Client for self-eval flows) |

## Pricing (server-side)

| Model | Price (USDC) |
|-------|-------------|
| `claude-haiku` (4.5) | 0.001 |
| `claude-sonnet` (4.5) | 0.005 |
| `gpt-4o-mini` | 0.001 |
| `gpt-4o` | 0.008 |
| `auto` | 0.002 (cheapest available) |

Protocol fee: **0.5%** on Completed payouts (configurable, max 10%).

## Security

- ✅ ERC-8183 lifecycle enforced on-chain
- ✅ Single-evaluator design protects provider after submission
- ✅ Permissionless `claimRefund` after expiry (anyone can trigger)
- ✅ `claimRefund` not hookable (per ERC-8183, anti-block guarantee)
- ⚠️ Single-token (native USDC) — multi-token version planned
- ⚠️ No reputation layer yet — planned via ERC-8004 integration

## Roadmap

- [x] ERC-8183 ACP contract
- [x] Anthropic Claude provider integration
- [x] Smart routing (`auto` mode)
- [x] One-call SDK (JS)
- [x] Next.js dashboard with try-it form + live job feed
- [x] Deployed on Arc testnet (local + public)
- [ ] OpenAI + Google Gemini providers
- [ ] Python SDK
- [ ] USYC vault — idle agent USDC earns yield
- [ ] Multi-provider quality routing (per-model latency/cost optimization)
- [ ] Reputation system (ERC-8004 integration)
- [ ] Demo video
- [ ] Hackathon submission (lablab.ai Agentic Economy on Arc, 4/20-26)

## Built for

- **Lablab.ai "Agentic Economy on Arc" hackathon** (Apr 20-26, 2026) — sponsored by Circle + Google DeepMind
- **Arc Builders Fund** — institutional infra for the agentic economy on Arc

## License

MIT

---

*Built solo with Claude Code in 1 day. Production deployment + scaling in progress.*
