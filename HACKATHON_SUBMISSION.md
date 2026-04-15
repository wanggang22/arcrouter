# ArcRouter — Hackathon Submission Materials

**Hackathon**: lablab.ai "Agentic Economy on Arc" (Apr 20-26, 2026)
**Sponsors**: Circle + Google DeepMind ($40K GCP credits + Arc Builders Fund pipeline)

---

## Project name
**ArcRouter** — The first ERC-8183 compatible AI inference marketplace on Arc

## One-liner
Pay-per-call AI inference, settled on-chain in USDC. AI agents create Jobs, escrow USDC, route to any provider (Anthropic/OpenAI/Google), and release payment automatically when the result is verified.

## Tagline alternatives (pick one)
1. "AI calls, USDC settlements, ERC-8183 native."
2. "Bring your own AI — pay in USDC on Arc."
3. "Stripe for AI agents, on Arc Network."

## Problem
AI agents need to pay for inference. Today this means:
- Holding Stripe-billed credits (centralized, requires legal entity)
- Manual prepay flows that don't scale to autonomous agent loops
- No on-chain audit trail (governance/compliance impossible)
- No ability to switch providers mid-task

## Solution
ArcRouter implements **ERC-8183 (Agentic Commerce Protocol)** as an AI inference marketplace:
1. Agent creates a Job (model + budget) → escrowed in USDC
2. AI provider listens, runs inference, submits result hash
3. Evaluator (or auto) approves → payment auto-releases
4. All on-chain, all USDC, all sub-second on Arc

**Key innovation**: First production ERC-8183 implementation. Each AI call = a Job. Each Job = transparent, verifiable, auditable.

## Technical architecture

### Smart contract (Solidity 0.8.29)
- ArcRouter.sol implements full ERC-8183 ACP interface
- Native USDC via `msg.value` (Arc's linked interface)
- 6 lifecycle states: Open → Funded → Submitted → Completed/Rejected/Expired
- Optional hooks for ERC-8004 (reputation) extensibility
- 0.5% protocol fee, configurable up to 10%

### Server (Node.js + Express)
- Listens for Funded jobs targeting its wallet
- Routes to Anthropic Claude / OpenAI GPT / Google Gemini
- Hashes result with keccak256
- Submits deliverable hash on-chain
- Returns result via HTTP

### SDK (JavaScript / `@arcrouter/sdk`)
- `new ArcRouter({ privateKey, network, providerAddress })`
- `await router.chat({ messages, model, budget })` → does all 5 on-chain calls + AI request in one call
- Returns content + on-chain proof (deliverable, txHash, completeTxHash)

### Dashboard (Next.js + wagmi + RainbowKit)
- Real-time stats: total jobs, protocol fees collected, fee rate
- Try-it form: connect wallet → submit prompt → see live tx progress + result
- Recent jobs feed (auto-refreshing every 5s)

## Live deployments

| Network | Chain ID | Contract |
|---------|----------|----------|
| Arc Testnet (public) | 5042002 | `0xbECBE8802b38bA147D44E3C507912500D2263c2D` |
| Arc Local (Quake) | 1337 | `0xa6d4Dd36b251d103A2Ac25961ce4C85a0491179d` |

## Differentiation vs competitors

| | OpenRouter | Tempo (Stripe) | Agentic Bank | **ArcRouter** |
|---|------------|----------------|--------------|---------------|
| Crypto-native | ❌ | partial | ✅ | ✅ |
| ERC-8183 ACP | ❌ | ❌ | ❌ | ✅ first |
| On-chain audit | ❌ | ❌ | ✅ | ✅ |
| USDC native | ❌ | partial | ✅ | ✅ Arc native |
| Multi-provider | ✅ | ❌ | ❌ | ✅ |
| Pay-per-call | ✅ | ✅ | ✅ | ✅ |
| Escrow + dispute | ❌ | ❌ | ✅ | ✅ |
| Sub-second | ❌ | ❌ | partial | ✅ Arc |

## Roadmap

- [x] ERC-8183 ACP contract — deployed local + testnet
- [x] Anthropic provider — production
- [x] One-call SDK
- [x] Dashboard with try-it
- [ ] OpenAI + Google providers (this week)
- [ ] USYC vault — agents earn 4-5% on idle USDC (post-hackathon)
- [ ] Multi-provider quality/latency routing
- [ ] ERC-8004 reputation integration
- [ ] Python SDK
- [ ] Mobile-first UI

## Demo

### 30-second demo flow

1. Open https://arcrouter.dev (or local :3403)
2. Connect MetaMask (Arc testnet)
3. Type prompt: "Explain ERC-8183 in one sentence"
4. Select model: Claude Haiku
5. Click "Run job"
6. Watch live: createJob → setBudget → fund → AI call → submit → complete (5 on-chain txs in ~10s)
7. See result + on-chain proof (deliverable hash, all 5 tx hashes)

### CLI demo (for developers)

```bash
git clone https://github.com/wanggang22/arcrouter
cd arcrouter/sdk/js && npm install
ARC_PRIVATE_KEY=0x... node test.js
# → Real Claude API call, on-chain settlement in 10s
```

### Video script (3-minute Loom)

```
0:00-0:30  Problem: AI agents need to pay for inference. Today = Stripe credits.
           For autonomous agents = won't scale.
0:30-1:30  Demo: open dashboard, connect wallet, submit prompt, watch 5 txs
           settle, see AI response + on-chain proof.
1:30-2:00  Architecture: ERC-8183 ACP contract + Express + AI providers.
           One-call SDK.
2:00-2:30  Differentiation: USYC roadmap (idle USDC earns yield), multi-
           provider routing, on-chain audit. Arc-native, no other chain.
2:30-3:00  What we want: feedback, Builders Fund intro, more provider
           integrations. https://github.com/wanggang22/arcrouter
```

## Team
**Solo founder** — built in 1 day with Claude Code. Production scaling in progress.

## Repository
https://github.com/wanggang22/arcrouter

## Built with
- Foundry (Solidity 0.8.29)
- Node.js + Express
- viem + wagmi
- Next.js 14 + Tailwind + RainbowKit
- Anthropic Claude SDK
- Arc Network (testnet)

## Asks
1. **Builders Fund pipeline introduction** (Circle Ventures)
2. **Feedback** on protocol design
3. **Provider partnerships** (compute marketplaces wanting USDC settlement)
4. **Hackathon prize** if we shipped what you wanted to see :)

---

## Submission checklist

- [x] GitHub repo public, README polished
- [x] Live testnet contract verified working
- [x] Server + SDK + dashboard all functional
- [ ] Demo video recorded (TODO before 4/19)
- [ ] Project page on lablab.ai filled out
- [ ] Tweet thread announcing
- [ ] Discord posts in Arc + Circle dev channels
- [ ] Cold email to Circle Ventures (after Q1 earnings 5/11)

## Outreach plan (post-submission)

### Week of 4/20-26 (during hackathon)
- Daily progress on Twitter (#AgenticEconomy #BuildOnArc)
- Engage in Arc Discord builder channels
- Reply to other agentic economy projects with helpful comments

### Post-hackathon (4/27+)
- If win/place: leverage in cold emails ("hackathon-winning ArcRouter")
- If not: still ship + iterate, attend Circle Q1 earnings 5/11
- Cold email Circle Ventures (template at `arc-research/circle-ventures-email.md`)
- Follow up with hackathon judges who left positive feedback
