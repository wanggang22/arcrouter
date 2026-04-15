#!/bin/bash
# ArcRouter end-to-end demo via curl + cast (no SDK)
# Run after server is up and contract is deployed.

set -e
export PATH="$HOME/.cargo/bin:$HOME/.foundry/bin:$PATH"

RPC=${ARC_RPC:-http://localhost:8545}
ARCROUTER=${ARCROUTER:-0xa6d4Dd36b251d103A2Ac25961ce4C85a0491179d}
SERVER=${SERVER:-http://localhost:3402}
PROVIDER=${PROVIDER:-0x20E40d46631026891D89CA1d33a94073D561B23B}

# Use account5 as client (must have USDC balance)
CLIENT_KEY=$(grep "^PRIVATE_KEY=" "$HOME/arc-accounts/account5/.env" 2>/dev/null | cut -d= -f2 | tr -d '\r')
CLIENT_ADDR=$(grep "^ADDRESS=" "$HOME/arc-accounts/account5/.env" 2>/dev/null | cut -d= -f2 | tr -d '\r')

if [ -z "$CLIENT_KEY" ]; then
  echo "Set CLIENT_KEY env var (no arc-accounts/ found)"
  exit 1
fi

echo "🎬 ArcRouter end-to-end demo"
echo "  RPC:       $RPC"
echo "  Contract:  $ARCROUTER"
echo "  Server:    $SERVER"
echo "  Client:    $CLIENT_ADDR"
echo "  Provider:  $PROVIDER"
echo ""

EXPIRE=$(($(date +%s) + 3600))
BUDGET=2000000000000  # 0.000002 USDC

echo "▶ 1. createJob (Open)"
cast send --rpc-url $RPC --private-key $CLIENT_KEY $ARCROUTER \
  "createJob(address,address,uint256,string,address)" \
  $PROVIDER $CLIENT_ADDR $EXPIRE "demo: explain Arc in one sentence" \
  0x0000000000000000000000000000000000000000 > /dev/null
JOB_ID=$(($(cast call --rpc-url $RPC $ARCROUTER "jobCount()(uint256)") - 1))
echo "  ✓ Job #$JOB_ID created"

echo "▶ 2. setBudget"
cast send --rpc-url $RPC --private-key $CLIENT_KEY $ARCROUTER \
  "setBudget(uint256,uint256,bytes)" $JOB_ID $BUDGET 0x > /dev/null
echo "  ✓ Budget = 0.000002 USDC"

echo "▶ 3. fund (Open → Funded)"
cast send --rpc-url $RPC --private-key $CLIENT_KEY $ARCROUTER \
  "fund(uint256,bytes)" $JOB_ID 0x --value $BUDGET > /dev/null
echo "  ✓ Escrowed"

echo "▶ 4. POST /v1/chat/completions (server runs Anthropic, submits hash on-chain)"
RESULT=$(curl -sL -X POST "$SERVER/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{\"jobId\":$JOB_ID,\"model\":\"claude-haiku\",\"messages\":[{\"role\":\"user\",\"content\":\"Explain Arc Network's USDC-as-gas in 1 sentence.\"}]}")
echo "  ✓ AI response:"
echo "$RESULT" | python -c "import json,sys; d=json.load(sys.stdin); print('   ', d['content'])"

echo "▶ 5. complete (Submitted → Completed, payment released)"
cast send --rpc-url $RPC --private-key $CLIENT_KEY $ARCROUTER \
  "complete(uint256,bytes32,bytes)" $JOB_ID \
  0x0000000000000000000000000000000000000000000000000000000000000000 0x > /dev/null
echo "  ✓ Payment released to provider"

echo ""
echo "✅ Done. Job #$JOB_ID complete in 5 on-chain txs."
echo "   Provider paid: $(echo "scale=6; ($BUDGET * 9950 / 10000) / 1000000000000000000" | bc) USDC"
echo "   Protocol fee:  $(echo "scale=6; ($BUDGET * 50 / 10000) / 1000000000000000000" | bc) USDC"
