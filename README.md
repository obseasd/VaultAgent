# VaultAgent

**AI-powered encrypted conditional escrow on SKALE via BITE v2**

> Trustless conditional payments where escrow terms are encrypted on-chain and an AI agent acts as impartial judge to verify delivery before releasing funds. Zero gas. Full privacy. Agentic commerce via x402.

**Live Demo**: [vaultagent-umber.vercel.app](https://vaultagent-umber.vercel.app)
**Contract**: [`0xBFd5542a97E96D8F2E2D1A39E839c7A15bA731E1`](https://base-sepolia-testnet-explorer.skalenodes.com:10032/address/0xBFd5542a97E96D8F2E2D1A39E839c7A15bA731E1) on SKALE BITE V2 Sandbox
**Track**: Encrypted Agents — [San Francisco Agentic Commerce x402 Hackathon](https://dorahacks.io/hackathon/x402/detail)

---

## The Problem

Traditional escrow systems suffer from three fundamental issues:

1. **Transparency leak** — Payment amounts and conditions are visible to all parties, enabling front-running and manipulation
2. **Centralized arbitration** — A human mediator must decide disputes, which is slow, biased, and expensive
3. **No agent interoperability** — No standard for AI agents to pay for or sell verification services

## The Solution

VaultAgent combines three technologies to solve all three:

| Problem | Solution | Technology |
|---------|----------|------------|
| Transparency leak | Escrow terms encrypted on-chain | **SKALE BITE v2** (CTX) |
| Centralized arbitration | AI agent verifies conditions impartially | **Claude API** |
| Agent interoperability | Verification endpoint behind HTTP paywall | **x402 protocol** |

---

## How It Works

```
 BUYER                    SKALE + BITE v2                 SELLER
   │                           │                            │
   │  1. Create escrow         │                            │
   │  (amount encrypted,       │                            │
   │   condition hashed)       │                            │
   │ ────────────────────────> │                            │
   │                           │                            │
   │                           │  2. Deliver product/service│
   │                           │ <──────────────────────────│
   │                           │                            │
   │                           │  3. Submit proof           │
   │                           │ <──────────────────────────│
   │                           │                            │
   │                    ┌──────┴──────┐                     │
   │                    │  AI AGENT   │                     │
   │                    │  (Claude)   │                     │
   │                    │  Analyzes   │                     │
   │                    │  proof vs   │                     │
   │                    │  condition  │                     │
   │                    └──────┬──────┘                     │
   │                           │                            │
   │               ┌───────────┴───────────┐                │
   │               │                       │                │
   │          PASSED ✓                FAILED ✗              │
   │          BITE decrypts           Buyer can             │
   │          Payment sent            dispute or            │
   │          to seller               wait for refund       │
   │               │                       │                │
   │               ▼                       ▼                │
   │         RECEIPT LOGGED          TIMEOUT REFUND         │
```

### Lifecycle

1. **Encrypted Intent** — Buyer encrypts payment amount via BITE v2 SDK. Condition is hashed (keccak256). Both stored on-chain but unreadable.
2. **CTX Submission** — Smart contract submits a Confidential Transaction (CTX) to BITE. The `onDecrypt` callback will fire when conditions are met.
3. **AI Verification** — Seller submits delivery proof. Claude AI analyzes proof against the condition with a confidence score.
4. **Conditional Execution** — If AI passes with sufficient confidence, the escrow is released: BITE decrypts the amount, funds transfer to seller.
5. **Receipt & Audit** — Every step is logged as an on-chain event with timestamps. A receipt URI is stored for the final transaction.
6. **Failure Handling** — Timeout auto-refund if seller doesn't deliver. Either party can dispute to freeze the escrow.

---

## Architecture

```
vaultagent/
├── contracts/                     # Solidity 0.8.27 + Hardhat
│   └── VaultEscrow.sol            # BITE v2 CTX integration
│
├── agent/                         # Hono server (standalone)
│   ├── agent.ts                   # Claude AI condition verifier
│   ├── server.ts                  # Hono + x402 payment middleware
│   ├── client.ts                  # Test client
│   └── x402-client.ts            # x402 paid verification client
│
├── web/                           # Next.js 14 (Vercel)
│   ├── src/app/
│   │   ├── page.tsx               # Create escrow (swap-card UI)
│   │   ├── escrows/page.tsx       # Manage escrows
│   │   ├── verify/page.tsx        # Submit proof + AI verification
│   │   └── api/
│   │       ├── verify-condition/  # AI verification API route
│   │       ├── escrow-status/     # Escrow data API
│   │       └── create-escrow/     # Escrow creation API
│   └── src/lib/
│       ├── bite.ts                # BITE v2 SDK wrapper
│       ├── contract.ts            # ABI + addresses
│       └── wallet.tsx             # Wallet context provider
│
└── .env.example
```

---

## BITE v2 Integration (Deep Dive)

VaultAgent uses BITE v2's **Confidential Transactions (CTX)** to encrypt escrow terms on-chain:

### On-Chain (Solidity)

```solidity
// 1. Buyer submits encrypted amount
bytes[] memory encArgs = new bytes[](1);
encArgs[0] = encryptedTerms;  // BITE-encrypted amount

// 2. Submit CTX — BITE will call onDecrypt when ready
address payable callbackSender = BITE.submitCTX(
    BITE.SUBMIT_CTX_ADDRESS, 200000, encArgs, plainArgs
);

// 3. Pay CTX gas callback
callbackSender.call{value: 0.06 ether}("");
```

### Off-Chain (TypeScript)

```typescript
// Encrypt amount before sending to contract
const { BITE } = await import("@skalenetwork/bite");
const bite = new BITE(RPC_URL);
const encrypted = await bite.encryptMessage(encodedAmount);
```

### Callback (Decryption)

```solidity
// BITE calls this when decryption is triggered
function onDecrypt(bytes[] calldata decryptedArgs, bytes[] calldata plaintextArgs) {
    uint256 escrowId = abi.decode(plaintextArgs[0], (uint256));
    uint256 amount = abi.decode(decryptedArgs[0], (uint256));
    escrows[escrowId].amount = amount;
    escrows[escrowId].decrypted = true;
}
```

**What stays encrypted:**
- Payment amount (until AI verification triggers release)
- Escrow conditions (hashed, never revealed on-chain)

**What's public:**
- Buyer/seller addresses, escrow status, timestamps, AI verdict

---

## x402 Integration

The agent server exposes AI verification behind the [x402 HTTP payment protocol](https://www.x402.org/):

```
Agent A ──POST /api/verify-paid──> VaultAgent Server
                                        │
                                   402 Payment Required
                                   (price: 0.01 Axios USD)
                                        │
Agent A ──signs EIP-712 payment──> Facilitator (dirtroad.dev)
                                        │
                                   Payment verified on-chain
                                        │
Agent A <──AI verification result── VaultAgent Server
```

### Endpoints

| Endpoint | Auth | Price | Description |
|----------|------|-------|-------------|
| `POST /api/verify` | None | Free | AI condition verification |
| `POST /api/verify-paid` | x402 | 0.01 USD | Same + payment proof |

### x402 Server Setup

```typescript
// Hono middleware gates /api/verify-paid behind x402 paywall
app.use("/api/verify-paid", paymentMiddleware({
  "POST /api/verify-paid": {
    accepts: [{
      scheme: "exact",
      network: "eip155:103698795",
      payTo: receivingAddress,
      price: { amount: "10000", asset: AXIOS_USD_ADDRESS },
    }],
  },
}, resourceServer));
```

### x402 Client Usage

```typescript
import { wrapFetchWithPayment } from "@x402/core";

const paymentFetch = wrapFetchWithPayment(fetch, wallet);
const result = await paymentFetch("http://agent:3001/api/verify-paid", {
  method: "POST",
  body: JSON.stringify({ condition, proof, context }),
});
```

---

## Privacy Model

| Data | On-Chain Visibility | When Revealed |
|------|-------------------|---------------|
| Payment amount | **Encrypted** (BITE v2 CTX) | After AI verification passes |
| Escrow conditions | **Hashed** (keccak256) | Never on-chain (only hash) |
| AI verdict | Public event log | After verification |
| Buyer/seller | Public | Always |
| Receipt URI | Public | After release |

---

## Failure Handling & Guardrails

| Scenario | Handling |
|----------|---------|
| Seller doesn't deliver | Buyer claims refund after timeout expires |
| AI rejects proof | Escrow stays active, seller can retry or buyer disputes |
| Dispute raised | Escrow frozen (status: Disputed) |
| CTX gas not paid | Transaction reverts — escrow not created |
| Invalid seller | Transaction reverts — address(0) or self-escrow blocked |

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Smart Contract | Solidity 0.8.27 | BITE v2 requires >= 0.8.27, EVM Istanbul |
| On-chain Encryption | @skalenetwork/bite-solidity | CTX for confidential transactions |
| Off-chain Encryption | @skalenetwork/bite | TypeScript SDK for BITE v2 |
| Network | SKALE BITE V2 Sandbox | Zero gas + native encryption |
| AI Agent | Claude API (Anthropic) | Condition verification with confidence scoring |
| Agent Server | Hono | Lightweight, x402-compatible HTTP server |
| x402 Payments | @x402/hono + @x402/evm | HTTP 402 payment protocol for agent commerce |
| x402 Facilitator | facilitator.dirtroad.dev | SKALE-hosted payment facilitator |
| Web Dashboard | Next.js 14 | SSR + API routes |
| Styling | Tailwind CSS | Utility-first, dark theme |
| Wallet | ethers.js v6 | MetaMask integration |
| Deploy (web) | Vercel | Serverless Next.js hosting |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask
- sFUEL (free — request in [SKALE Telegram](https://t.me/+dDdvu5T6BOEzZDEx))

### Install & Run

```bash
git clone https://github.com/obseasd/VaultAgent.git && cd VaultAgent
npm install

cp .env.example .env
# Fill: PRIVATE_KEY, ANTHROPIC_API_KEY, NEXT_PUBLIC_CONTRACT_ADDRESS, RECEIVING_ADDRESS

# Compile & deploy contract
npm run compile
npm run deploy

# Start AI agent server (port 3001)
npm run dev:agent

# Start web dashboard (port 3000)
npm run dev:web
```

### Add SKALE to MetaMask

| Field | Value |
|-------|-------|
| Network | SKALE BITE V2 Sandbox |
| RPC | `https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox` |
| Chain ID | `103698795` |
| Currency | sFUEL |
| Explorer | `https://base-sepolia-testnet-explorer.skalenodes.com:10032` |

---

## Deployed Addresses

| What | Address / URL |
|------|--------------|
| VaultEscrow Contract | `0xBFd5542a97E96D8F2E2D1A39E839c7A15bA731E1` |
| Network | SKALE BITE V2 Sandbox (Chain ID: 103698795) |
| Web Dashboard | [vaultagent-umber.vercel.app](https://vaultagent-umber.vercel.app) |
| x402 Facilitator | [facilitator.dirtroad.dev](https://facilitator.dirtroad.dev) |
| Axios USD (x402) | `0x61a26022927096f444994dA1e53F0FD9487EAfcf` |

---

## Hackathon

Built for the **San Francisco Agentic Commerce x402 Hackathon** ($50K prize pool) — **Encrypted Agents** track.

**Judging Criteria Met:**
- BITE v2 usage that materially changes the workflow (encrypted escrow terms)
- Conditional trigger (AI verification → decrypt → execute)
- Full lifecycle audit (create → encrypt → verify → release → receipt)
- UX showing what's private, when it unlocks, who triggers
- Guardrails (timeout refund, dispute, CTX gas requirement)
- Failure handling (timeout auto-refund, dispute freeze)
- x402 agent-to-agent payment protocol integration

## License

MIT
