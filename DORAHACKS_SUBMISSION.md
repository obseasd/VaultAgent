# DoraHacks BUIDL Submission — VaultAgent

## Project Name
VaultAgent

## Vision (max 256 chars)
AI-powered encrypted conditional escrow on SKALE. BITE v2 encrypts payment terms on-chain. Claude AI verifies delivery before releasing funds. x402 enables agent-to-agent paid verification. Zero gas, full privacy.

## Category
Crypto/Web3

## Key Innovation Domains
AI Agent, Privacy/Encryption, DeFi

## L1/L2
SKALE Network

## Tracks
Encrypted Agents

---

## Full Description (for "Description" field)

### VaultAgent — AI Encrypted Conditional Escrow on SKALE

VaultAgent is an AI-powered encrypted conditional escrow system built on SKALE using BITE v2. It enables trustless conditional payments where escrow terms (amount and conditions) are encrypted on-chain, and an AI agent (Claude) acts as an impartial judge to verify delivery proofs before triggering decryption and releasing funds.

---

### The Problem

Traditional escrow systems have three critical flaws:

1. **Transparency leak** — Payment amounts and conditions are visible to all parties on-chain, enabling front-running, manipulation, and information asymmetry.

2. **Centralized arbitration** — Dispute resolution requires human mediators who are slow, expensive, and potentially biased.

3. **No agent interoperability** — There's no standard protocol for AI agents to buy/sell verification services from each other.

---

### How VaultAgent Works

**Step 1: Encrypted Escrow Creation**
The buyer creates an escrow with encrypted terms. The payment amount is encrypted via BITE v2 SDK off-chain, then submitted on-chain as a Confidential Transaction (CTX). The escrow condition is hashed (keccak256) so only the hash is stored on-chain — the actual condition text is never revealed publicly.

**Step 2: Delivery & Proof Submission**
The seller delivers the agreed product/service, then submits a proof of delivery through the VaultAgent dashboard. The proof can include URLs, descriptions, logs, or any evidence that the condition was fulfilled.

**Step 3: AI Verification**
The Claude AI agent analyzes the submitted proof against the escrow condition. It returns:
- A pass/fail verdict
- A confidence score (0-100%)
- A detailed reasoning explanation
- Specific details about what was verified

**Step 4: Conditional Execution**
If the AI verification passes, the escrow can be released:
- BITE v2 decrypts the payment amount via the `onDecrypt` callback
- Funds are transferred to the seller automatically
- A receipt URI is stored on-chain for the audit trail

**Step 5: Failure Handling**
If verification fails:
- The escrow stays active — the seller can submit additional proof
- The buyer can raise a dispute (freezes the escrow)
- After the timeout period, the buyer can claim a full refund automatically

---

### BITE v2 Integration (Encrypted Agents Track)

VaultAgent uses BITE v2's Confidential Transactions (CTX) in a way that **materially changes the escrow workflow**:

**What's encrypted:**
- **Payment amount** — Stays encrypted on-chain via BITE v2 CTX until the AI agent verifies the condition. The `onDecrypt` callback reveals the amount only when conditions are met.
- **Escrow conditions** — Hashed on-chain (keccak256). The condition text is only shared between buyer and seller off-chain. The hash ensures tamper-proof verification without revealing the terms.

**Why this matters:**
- The buyer can't be front-run because the amount is hidden
- The seller can't manipulate conditions because they're hashed before the escrow is created
- The AI agent judges based on the original condition text + submitted proof, not on-chain data manipulation

**Technical implementation:**
```
Off-chain: BITE SDK encrypts amount → encryptedTerms
On-chain:  submitCTX(encryptedTerms) → BITE processes → onDecrypt(amount)
Trigger:   AI passes verification → releaseEscrow() → funds to seller
```

**Lifecycle audit trail (on-chain events):**
1. `EscrowCreated` — Escrow ID, buyer, seller, condition hash
2. `EscrowDecrypted` — BITE reveals the amount
3. `ConditionVerified` — AI verdict logged
4. `EscrowReleased` — Funds sent, receipt URI stored
5. `EscrowRefunded` / `EscrowDisputed` — Failure paths

---

### x402 Agent Commerce Integration

VaultAgent's AI verification service is exposed via the x402 HTTP payment protocol, enabling agent-to-agent commerce:

**Architecture:**
- The Hono agent server runs as a standalone service
- `POST /api/verify` — Free AI verification endpoint
- `POST /api/verify-paid` — x402-gated endpoint (0.01 Axios USD per verification)

**How x402 works:**
1. An external agent calls `/api/verify-paid`
2. The server returns `402 Payment Required` with payment details in headers
3. The agent's wallet signs an EIP-712 payment authorization
4. The SKALE facilitator (facilitator.dirtroad.dev) verifies the payment on-chain
5. The server returns the AI verification result

**Why this matters:**
- Any AI agent can programmatically buy escrow verification services
- VaultAgent monetizes its AI capabilities via standard HTTP payments
- No custom integration needed — x402 is built on HTTP standards
- Payments settle on SKALE with zero gas fees

**Server setup:**
```typescript
paymentMiddleware({
  "POST /api/verify-paid": {
    accepts: [{
      scheme: "exact",
      network: "eip155:103698795", // SKALE BITE Sandbox
      payTo: receivingAddress,
      price: { amount: "10000", asset: AXIOS_USD },
    }],
  },
}, resourceServer)
```

**Client usage:**
```typescript
const paymentFetch = wrapFetchWithPayment(fetch, wallet);
const result = await paymentFetch("/api/verify-paid", { ... });
```

---

### Privacy Model

| Data | On-Chain Visibility | When Revealed |
|------|-------------------|---------------|
| Payment amount | Encrypted (BITE v2 CTX) | After AI verification passes |
| Escrow conditions | Hashed (keccak256) | Never on-chain |
| AI verdict | Public event log | After verification |
| Buyer/seller addresses | Public | Always |
| Timestamps | Public | Always |
| Receipt URI | Public | After release |

---

### Failure Handling & Guardrails

| Scenario | Handling |
|----------|---------|
| Seller doesn't deliver | Buyer claims refund after timeout expires |
| AI rejects proof | Escrow stays active, seller can retry |
| Dispute raised | Escrow frozen for arbitration |
| CTX gas not paid | Transaction reverts |
| Invalid seller | Transaction reverts (address(0) or self-escrow) |
| x402 payment fails | Graceful fallback to free endpoint |

---

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract | Solidity 0.8.27 (EVM Istanbul) |
| On-chain Encryption | @skalenetwork/bite-solidity (CTX) |
| Off-chain Encryption | @skalenetwork/bite (TypeScript SDK) |
| Network | SKALE BITE V2 Sandbox (Chain ID: 103698795) |
| AI Agent | Claude API (@anthropic-ai/sdk) |
| Agent Server | Hono + @x402/hono middleware |
| x402 Payments | @x402/core + @x402/evm |
| x402 Facilitator | facilitator.dirtroad.dev (SKALE-hosted) |
| Web Dashboard | Next.js 14 + Tailwind CSS |
| Wallet | ethers.js v6 |
| Deployment | Vercel (web) |

---

### Links

- **Live Demo**: https://vaultagent-umber.vercel.app
- **GitHub**: https://github.com/obseasd/VaultAgent
- **Contract**: 0xBFd5542a97E96D8F2E2D1A39E839c7A15bA731E1 (SKALE BITE V2 Sandbox)
- **Explorer**: https://base-sepolia-testnet-explorer.skalenodes.com:10032/address/0xBFd5542a97E96D8F2E2D1A39E839c7A15bA731E1
