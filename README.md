# VaultAgent — AI Encrypted Conditional Escrow on SKALE

**Encrypted conditional payments powered by AI verification on SKALE via BITE v2.**

Buyers create escrows with encrypted terms (amount + conditions hidden on-chain). Sellers deliver and submit proof. An AI agent (Claude) analyzes the proof and triggers decryption + payment if conditions are met.

## Why VaultAgent?

- **Anti-front-running**: Amount and conditions stay encrypted via BITE v2 until execution
- **Tamper-proof**: Conditions are hidden from the seller — no manipulation possible
- **AI arbitration**: Claude acts as an impartial judge to verify delivery proofs
- **Zero gas**: Runs on SKALE — no gas fees for users
- **Full audit trail**: Every step is logged with timestamps and tx hashes

## Architecture

```
vaultagent/
├── contracts/          # Hardhat + Solidity — VaultEscrow with BITE v2 CTX
├── agent/              # Hono server + Claude AI condition verifier
└── web/                # Next.js 14 dashboard (create, manage, verify escrows)
```

## Flow

1. **Buyer** creates an escrow — amount encrypted via BITE v2, condition hashed on-chain
2. **Seller** delivers the product/service and submits proof
3. **AI Agent** (Claude) analyzes the proof against the condition
4. **If passed**: BITE decrypts → payment released to seller automatically
5. **If failed**: Buyer can dispute or wait for timeout auto-refund

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract | Solidity 0.8.27 (EVM Istanbul) |
| Encryption | @skalenetwork/bite-solidity + @skalenetwork/bite |
| Network | SKALE BITE V2 Sandbox (Chain ID: 103698795) |
| Web | Next.js 14 + Tailwind CSS |
| Wallet | ethers.js v6 |
| AI Agent | Claude API (@anthropic-ai/sdk) |
| Agent Server | Hono |

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask with SKALE BITE V2 Sandbox network
- sFUEL (free — request in [SKALE Telegram](https://t.me/+dDdvu5T6BOEzZDEx))

### Setup

```bash
# Clone and install
git clone <repo-url> && cd vaultagent
npm install

# Configure environment
cp .env.example .env
# Fill in PRIVATE_KEY, ANTHROPIC_API_KEY, etc.

# Compile and deploy contract
npm run compile
npm run deploy

# Start the AI agent server
npm run dev:agent

# Start the web dashboard
npm run dev:web
```

### Network Config (MetaMask)

| Field | Value |
|-------|-------|
| Network Name | SKALE BITE V2 Sandbox |
| RPC URL | https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox |
| Chain ID | 103698795 |
| Currency | sFUEL |
| Explorer | https://base-sepolia-testnet-explorer.skalenodes.com:10032 |

## Privacy Model

| Data | Visibility |
|------|-----------|
| Payment amount | **Encrypted** via BITE v2 until release |
| Escrow conditions | **Hashed** on-chain (only hash visible) |
| Buyer/seller addresses | Public |
| Escrow status | Public |
| AI verification result | Public (logged on-chain) |
| Timestamps | Public |

## Failure Handling

- **Timeout auto-refund**: If the seller doesn't deliver within the timeout period, the buyer can claim a full refund
- **Dispute mechanism**: Either party can freeze the escrow for AI arbitration
- **Guardrails**: CTX gas payment required (0.06 sFUEL), conditions must be non-empty

## Hackathon

Built for the [San Francisco Agentic Commerce x402 Hackathon](https://dorahacks.io/hackathon/x402/detail) — Encrypted Agents track.

## License

MIT
