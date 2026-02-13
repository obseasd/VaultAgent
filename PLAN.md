# VaultAgent — AI Encrypted Conditional Escrow on SKALE

## Track : Encrypted Agents (0 concurrent = victoire garantie)
## Hackathon : San Francisco Agentic Commerce x402 Hackathon ($50K)
## Deadline : 14 Feb 2026 08:59 UTC

---

## 1. Concept

**VaultAgent** est un agent IA qui gere des paiements conditionnels chiffres sur SKALE via BITE v2.

**Flow complet :**
1. Un acheteur cree un escrow chiffre (montant + conditions restent secrets via BITE v2)
2. Le vendeur livre le service/produit et soumet une preuve
3. L'agent IA (Claude) analyse la preuve et decide si les conditions sont remplies
4. Si oui : BITE dechiffre et execute le paiement automatiquement
5. Si non : l'agent explique pourquoi et l'acheteur peut disputer ou annuler
6. Un receipt/log complet est genere a chaque etape (audit trail)

**Pourquoi c'est pertinent :**
- L'acheteur ne revele PAS le montant/conditions avant execution (anti-front-running)
- Le vendeur ne peut pas manipuler les conditions car elles sont chiffrees
- L'IA est le juge impartial qui verifie les preuves
- Tout est on-chain sur SKALE (zero gas)

---

## 2. Criteres de Jugement et Comment On Score

| Critere | Ce que les juges veulent | Notre reponse |
|---------|--------------------------|---------------|
| **BITE v2 usage** | "materially changes the workflow" | Escrow terms chiffres, conditions cachees jusqu'a execution |
| **Conditional trigger** | "decrypt/execute only when condition(s) met" | AI verifie la preuve -> trigger onDecrypt -> paiement |
| **Lifecycle audit** | "policy/condition definition -> encrypted intent -> execution -> receipt/logs" | Dashboard affiche chaque etape avec timestamps et tx hashes |
| **UX & Trust** | "What is private? When does it unlock? Who can trigger?" | UI explique clairement ce qui est chiffre, quand ca se dechiffre |
| **Commerce-grade** | "guardrails (limits, allowlists, human approval)" | Spend caps, timeout auto-refund, dispute mechanism |
| **Failure handling** | "What happens if it fails?" | Auto-refund apres timeout, dispute flow avec arbitrage IA |

---

## 3. Architecture

```
vaultagent/
├── contracts/                    # Hardhat + Solidity 0.8.27
│   ├── contracts/
│   │   └── VaultEscrow.sol       # Escrow avec BITE v2 CTX
│   ├── test/
│   │   └── VaultEscrow.test.ts   # Tests
│   ├── scripts/
│   │   └── deploy.ts
│   └── hardhat.config.ts
│
├── agent/                        # Agent IA + x402 server
│   ├── server.ts                 # Hono + x402 middleware
│   ├── agent.ts                  # Claude condition verifier
│   └── client.ts                 # x402 payment client
│
├── web/                          # Next.js 14 dashboard
│   ├── src/app/
│   │   ├── page.tsx              # Landing + creer escrow
│   │   ├── escrows/page.tsx      # Voir/gerer ses escrows
│   │   ├── verify/page.tsx       # Soumettre une preuve
│   │   └── api/
│   │       ├── create-escrow/route.ts
│   │       ├── verify-condition/route.ts
│   │       └── escrow-status/route.ts
│   ├── src/lib/
│   │   ├── bite.ts               # BITE v2 SDK wrapper
│   │   └── contract.ts           # ABI + addresses
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── .env.example
├── package.json                  # Workspaces root
└── README.md
```

---

## 4. Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Smart Contract | Solidity | 0.8.27 (EVM Istanbul) |
| Build/Test | Hardhat | latest |
| Encryption | @skalenetwork/bite | ^0.7.0 |
| Encryption (Solidity) | @skalenetwork/bite-solidity | latest |
| Network | SKALE BITE V2 Sandbox 2 | Chain ID: 103698795 |
| Web Framework | Next.js | 14 |
| Styling | Tailwind CSS | 3.x |
| Wallet | ethers.js | v6 |
| x402 Server | Hono + @x402/hono | latest |
| x402 Client | @x402/core + @x402/evm | latest |
| AI Agent | Claude API (@anthropic-ai/sdk) | latest |
| Deploy web | Vercel | - |

---

## 5. Smart Contract — VaultEscrow.sol

### Specs

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/IBiteSupplicant.sol";

contract VaultEscrow is IBiteSupplicant {

    uint256 constant CTX_GAS_PAYMENT = 0.06 ether;

    enum EscrowStatus { Active, Released, Refunded, Disputed }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;           // rempli apres decryption
        EscrowStatus status;
        uint256 createdAt;
        uint256 timeout;          // auto-refund apres timeout
        bytes32 conditionHash;    // hash des conditions (public)
        string receiptURI;        // IPFS link du receipt final
        bool decrypted;
    }

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    // Events pour audit trail
    event EscrowCreated(uint256 indexed id, address buyer, address seller, bytes32 conditionHash);
    event EscrowDecrypted(uint256 indexed id, uint256 amount);
    event EscrowReleased(uint256 indexed id, address seller, uint256 amount);
    event EscrowRefunded(uint256 indexed id, address buyer, uint256 amount);
    event EscrowDisputed(uint256 indexed id, address initiator);
    event ConditionVerified(uint256 indexed id, bool passed, string reason);

    // Creer un escrow avec terms chiffres via BITE
    function createEscrow(
        address seller,
        uint256 timeout,
        bytes32 conditionHash,
        bytes calldata encryptedTerms  // chiffre par BITE SDK off-chain
    ) external payable returns (uint256) {
        escrowCount++;
        escrows[escrowCount] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: 0,  // sera rempli par onDecrypt
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            timeout: timeout,
            conditionHash: conditionHash,
            receiptURI: "",
            decrypted: false
        });

        // Soumettre le CTX pour decryption conditionnelle
        bytes[] memory encArgs = new bytes[](1);
        encArgs[0] = encryptedTerms;
        bytes[] memory plainArgs = new bytes[](1);
        plainArgs[0] = abi.encode(escrowCount);

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            200000,
            encArgs,
            plainArgs
        );

        emit EscrowCreated(escrowCount, msg.sender, seller, conditionHash);
        return escrowCount;
    }

    // Callback BITE — recoit les terms dechiffres
    function onDecrypt(
        bytes[] calldata decryptedArgs,
        bytes[] calldata plaintextArgs
    ) external override {
        uint256 escrowId = abi.decode(plaintextArgs[0], (uint256));
        uint256 amount = abi.decode(decryptedArgs[0], (uint256));

        Escrow storage e = escrows[escrowId];
        e.amount = amount;
        e.decrypted = true;

        emit EscrowDecrypted(escrowId, amount);
    }

    // Agent IA appelle ca apres verification de la condition
    function releaseEscrow(uint256 escrowId, string calldata receiptURI) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(e.decrypted, "Not decrypted yet");

        e.status = EscrowStatus.Released;
        e.receiptURI = receiptURI;

        // Transferer les fonds au vendeur
        payable(e.seller).transfer(e.amount);

        emit EscrowReleased(escrowId, e.seller, e.amount);
    }

    // Auto-refund si timeout expire
    function claimRefund(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(block.timestamp > e.createdAt + e.timeout, "Timeout not reached");
        require(msg.sender == e.buyer, "Not buyer");

        e.status = EscrowStatus.Refunded;
        payable(e.buyer).transfer(e.amount);

        emit EscrowRefunded(escrowId, e.buyer, e.amount);
    }

    // Dispute (gele l'escrow pour arbitrage)
    function dispute(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(msg.sender == e.buyer || msg.sender == e.seller, "Not party");

        e.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    // Views
    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }
}
```

### Points Critiques Hardhat
- **EVM version : Istanbul** (obligatoire pour BITE V2 Sandbox)
- **Solidity >= 0.8.27** (requis par @skalenetwork/bite-solidity)
- **CTX gas payment = 0.06 ether** (cout fixe pour le callback onDecrypt)
- **gasLimit toujours en dur** (estimateGas() ne marche pas avec BITE)

---

## 6. Hardhat Config

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "istanbul",  // CRITIQUE pour BITE v2
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    biteSandbox: {
      url: "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 103698795,
    },
    skaleTestnet: {
      url: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 324705682,
    },
  },
};

export default config;
```

---

## 7. BITE v2 Integration (Off-chain)

### bite.ts — Wrapper SDK

```typescript
import { BITE } from "@skalenetwork/bite";
import { ethers } from "ethers";

const RPC = "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";
const bite = new BITE(RPC);

// Chiffrer les termes d'un escrow
export async function encryptEscrowTerms(amount: bigint): Promise<string> {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amount]);
  const encrypted = await bite.encryptMessage(encoded);
  return encrypted;
}

// Envoyer une transaction chiffree
export async function sendEncryptedTransaction(
  from: string,
  to: string,
  data: string
): Promise<string> {
  const tx = { from, to, data, gasLimit: 300000 };
  const encryptedTx = await bite.encryptTransaction(tx);

  // Envoyer via MetaMask
  const txHash = await window.ethereum!.request({
    method: "eth_sendTransaction",
    params: [encryptedTx],
  });
  return txHash as string;
}

// Recuperer les donnees dechiffrees apres finality
export async function getDecryptedData(txHash: string) {
  await new Promise(r => setTimeout(r, 3000)); // attendre finality
  return bite.getDecryptedTransactionData(txHash);
}
```

---

## 8. Agent IA — Claude Condition Verifier

### agent.ts

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface VerificationResult {
  passed: boolean;
  confidence: number;
  reason: string;
  details: string[];
}

export async function verifyCondition(
  conditionDescription: string,
  proofData: string,
  escrowContext: { amount: string; buyer: string; seller: string }
): Promise<VerificationResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are VaultAgent, an AI escrow condition verifier on SKALE blockchain.
Your job is to analyze delivery proofs and determine if escrow conditions are met.
Be strict but fair. Always explain your reasoning.
Return JSON only.`,
    messages: [{
      role: "user",
      content: `## Escrow Context
- Amount: ${escrowContext.amount} sFUEL
- Buyer: ${escrowContext.buyer}
- Seller: ${escrowContext.seller}

## Condition to Verify
${conditionDescription}

## Proof Submitted by Seller
${proofData}

## Task
Analyze the proof against the condition. Return JSON:
{
  "passed": true/false,
  "confidence": 0-100,
  "reason": "one-line explanation",
  "details": ["detail1", "detail2"]
}`
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text);
}
```

---

## 9. x402 Protected API (Bonus Points)

### server.ts — Hono + x402

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = new Hono();
const facilitatorUrl = "https://facilitator.dirtroad.dev";
const receivingAddress = process.env.RECEIVING_ADDRESS as `0x${string}`;
const network = "eip155:324705682"; // SKALE Base Sepolia

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register("eip155:*", new ExactEvmScheme());

// Endpoint payant : verification de condition par l'IA
app.use(
  paymentMiddleware(
    {
      "POST /api/verify": {
        accepts: [{
          scheme: "exact",
          network,
          payTo: receivingAddress,
          price: {
            amount: "10000", // 0.01 USDC
            asset: "0x61a26022927096f444994dA1e53F0FD9487EAfcf",
            extra: { name: "Axios USD", version: "1" },
          },
        }],
        description: "AI condition verification for escrow",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.post("/api/verify", async (c) => {
  const body = await c.req.json();
  // Appeler l'agent IA Claude
  const result = await verifyCondition(body.condition, body.proof, body.context);
  return c.json(result);
});

serve({ fetch: app.fetch, port: 3001 });
```

---

## 10. Web Dashboard — Pages

### page.tsx (Landing + Create Escrow)
- Header "VaultAgent" avec logo shield/lock
- Section hero : "Encrypted Conditional Payments powered by AI"
- Formulaire : seller address, amount, condition description, timeout
- Bouton "Create Encrypted Escrow" -> chiffre via BITE -> envoie tx
- Animation de chiffrement pendant le process
- Affiche le receipt avec escrow ID et tx hash

### escrows/page.tsx (Manage Escrows)
- Liste de tous les escrows de l'utilisateur connecte
- Statut en couleur : Active (bleu), Released (vert), Refunded (gris), Disputed (rouge)
- Pour chaque escrow : ID, seller, status, created date, timeout countdown
- Bouton "Claim Refund" si timeout expire
- Bouton "Dispute" si probleme

### verify/page.tsx (Submit Proof)
- Le vendeur soumet sa preuve de livraison
- Champ : escrow ID, proof text/URL, fichier optionnel
- Bouton "Request AI Verification"
- Affiche le resultat de l'IA en temps reel :
  - Passed/Failed avec confidence score
  - Raison detaillee
  - Si passed : "Release Payment" button
- Log complet des etapes (audit trail)

### Theme UI
- Glassmorphism sombre (meme pattern que ClawForge/ShieldAI)
- Couleur principale : violet/indigo (#7c3aed) pour differencier
- Animations subtiles sur les etapes de chiffrement/dechiffrement

---

## 11. Network & Addresses

| Element | Valeur |
|---------|--------|
| Chain | SKALE BITE V2 Sandbox 2 |
| Chain ID | 103698795 |
| RPC | https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox |
| Explorer | https://base-sepolia-testnet-explorer.skalenodes.com:10032 |
| USDC | 0xc4083B1E81ceb461Ccef3FDa8A9F24F0d764B6D8 |
| Gas | sFUEL (gratuit, demander dans Telegram) |
| Facilitator x402 | https://facilitator.dirtroad.dev |
| Axios USD (x402) | 0x61a26022927096f444994dA1e53F0FD9487EAfcf |

---

## 12. .env.example

```
PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=103698795
NEXT_PUBLIC_RPC_URL=https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox
RECEIVING_ADDRESS=0x...
FACILITATOR_URL=https://facilitator.dirtroad.dev
PAYMENT_TOKEN_ADDRESS=0x61a26022927096f444994dA1e53F0FD9487EAfcf
```

---

## 13. Submission Requirements (checklist)

- [ ] **Demo video** (2-3 min) montrant le flow complet :
  1. Creer un escrow chiffre
  2. Voir que les termes sont caches on-chain
  3. Vendeur soumet une preuve
  4. IA analyse et decide
  5. Paiement dechiffre et execute
  6. Receipt final avec audit trail
  7. Montrer aussi le cas d'echec (condition non remplie)

- [ ] **Video postee sur Twitter** (obligatoire pour Overall Track)

- [ ] **GitHub repo** avec :
  - README complet avec screenshots
  - Quickstart instructions
  - Architecture diagram

- [ ] **Evidence** : screenshots/logs des BITE v2 flows + resultat final

- [ ] **Description claire** de :
  - Ce qui reste chiffre (montant, conditions)
  - Quelle condition dechiffre (AI verification passed)
  - Comment l'echec est gere (timeout refund, dispute)

---

## 14. Plan d'Execution

### Phase 1 — Smart Contract (2-3h)
1. Init monorepo npm workspaces
2. Ecrire VaultEscrow.sol avec BITE CTX
3. Ecrire tests Hardhat
4. Compiler avec evmVersion: istanbul
5. Deploy sur BITE V2 Sandbox

### Phase 2 — BITE Integration (2h)
1. Installer @skalenetwork/bite
2. Creer bite.ts wrapper (encrypt/decrypt)
3. Tester encryption off-chain -> CTX on-chain -> onDecrypt callback
4. Verifier que le flow fonctionne end-to-end

### Phase 3 — Agent IA (1-2h)
1. Creer agent.ts avec Claude API
2. Definir le prompt system pour condition verification
3. Tester avec differents types de preuves
4. Ajouter le server x402 (Hono) si le temps le permet

### Phase 4 — Web Dashboard (3-4h)
1. Init Next.js 14 + Tailwind
2. Page landing + create escrow form
3. Page escrows (liste + statuts)
4. Page verify (soumettre preuve + resultat IA)
5. Connecter wallet MetaMask via ethers.js v6
6. Integrer BITE SDK cote client

### Phase 5 — Polish & Submit (2h)
1. Glassmorphism UI theme violet
2. Enregistrer demo video
3. Poster sur Twitter
4. Ecrire README avec screenshots
5. Soumettre sur DoraHacks

---

## 15. Code Reutilisable depuis ClawForge/ShieldAI

| Composant | Source | Adaptation |
|-----------|--------|------------|
| Layout Next.js | ShieldAI layout.tsx | Changer couleur -> violet, nom -> VaultAgent |
| globals.css | ShieldAI globals.css | Changer accent colors |
| Wallet connect | ShieldAI (ethers.js v6) | Changer chain ID -> 103698795 |
| Glassmorphism | ClawForge/ShieldAI CSS | Copier tel quel |
| tailwind.config | ShieldAI | Copier + adapter couleurs |
| next.config | ShieldAI | Copier |

---

## 16. Risques et Mitigations

| Risque | Mitigation |
|--------|------------|
| BITE v2 SDK bugge | Tester tot, avoir un fallback sans CTX (simple encrypt/decrypt) |
| Pas de sFUEL | Demander dans le Telegram hackathon (tag @TheGreatAxios) |
| onDecrypt pas appele | Verifier gasLimit (200000), verifier CTX_GAS_PAYMENT (0.06 ether) |
| Deadline trop serree | Prioriser : contrat + BITE + dashboard basique > x402 server > polish |
| MetaMask refuse la chain | Ajouter via https://base-sepolia.skalenodes.com/chains/bite-v2-sandbox |

---

## 17. Pourquoi On Gagne

1. **0 concurrent** dans Encrypted Agents = victoire automatique si on submit
2. Le projet utilise BITE v2 de maniere **materielle** (pas juste "privacy as tagline")
3. L'IA comme juge de conditions = vrai use case commerce
4. Flow complet : encrypted -> condition -> decrypt -> execute -> receipt
5. UX claire : on explique ce qui est prive et pourquoi
6. Guardrails : timeout refund, dispute, spend caps
7. SKALE = sponsor principal, ils veulent voir BITE v2 utilise
8. Zero gas = demo fluide sans friction

**Gain minimum garanti : $2,000 USDC + $2,500 SKALE Credits**
**Gain potentiel avec Overall : +$9,500 = $14,000 total**

---

## 18. Liens Utiles

### Hackathon
- Page hackathon : https://dorahacks.io/hackathon/x402/detail
- Tracks & judging : https://dorahacks.io/hackathon/x402/tracks
- Projets soumis (19) : https://dorahacks.io/hackathon/x402/buidl
- Soumettre un BUIDL : https://dorahacks.io/hackathon/x402 (bouton "Submit BUIDL")
- S'inscrire : https://dorahacks.io/hackathon/x402 (bouton "Register as Hacker")

### SKALE — Docs & Setup
- Page hackathon SKALE : https://docs.skale.space/get-started/hackathon/info
- SKALE Docs (accueil) : https://docs.skale.space/
- Ajouter BITE Sandbox a MetaMask : https://base-sepolia.skalenodes.com/chains/bite-v2-sandbox
- Ajouter SKALE Base Sepolia a MetaMask : https://base-sepolia.skalenodes.com/chains/base-testnet
- Faucet sFUEL (Base Sepolia) : https://base-sepolia-faucet.skale.space
- Faucet sFUEL (multi-chain) : https://www.sfuelstation.com/
- Explorer BITE Sandbox : https://base-sepolia-testnet-explorer.skalenodes.com:10032
- Explorer SKALE Base Sepolia : https://base-sepolia-testnet-explorer.skalenodes.com/

### BITE v2 — Encryption
- BITE v2 TypeScript SDK docs : https://docs.skale.space/developers/bite-protocol/typescript-sdk
- Encrypted Transactions guide : https://docs.skale.space/developers/bite-protocol/encrypted-transactions
- npm : https://www.npmjs.com/package/@skalenetwork/bite
- npm (Solidity) : https://www.npmjs.com/package/@skalenetwork/bite-solidity

### x402 — HTTP Payment Protocol
- Intro x402 sur SKALE : https://docs.skale.space/get-started/agentic-builders/start-with-x402
- x402 site officiel : https://www.x402.org/
- x402 Coinbase docs : https://docs.cdp.coinbase.com/x402/welcome
- x402 GitHub (Coinbase) : https://github.com/coinbase/x402
- Facilitator SKALE (hosted) : https://facilitator.dirtroad.dev
- npm @x402/core : https://www.npmjs.com/package/@x402/core
- npm @x402/hono : https://www.npmjs.com/package/@x402/hono
- npm @x402/evm : https://www.npmjs.com/package/@x402/evm

### AP2 — Google Agent Payments Protocol
- AP2 Docs : https://ap2-protocol.org/
- AP2 Specification : https://ap2-protocol.org/specification/
- AP2 GitHub : https://github.com/google-agentic-commerce/AP2
- AP2 x402 Human-Present Sample : https://github.com/google-agentic-commerce/AP2 (dans samples/)
- A2A x402 Extension : https://github.com/google-agentic-commerce/AP2 (extensions/)
- Google Cloud Blog (annonce) : https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol

### ERC-8004 — Agent Identity & Reputation
- EIP Spec : https://eips.ethereum.org/EIPS/eip-8004
- Contracts GitHub : https://github.com/erc-8004/erc-8004-contracts
- Scaffolding CLI : https://github.com/Eversmile12/create-8004-agent
- npm SDK : https://www.npmjs.com/package/@agentic-trust/8004-ext-sdk
- Awesome ERC-8004 : https://github.com/sudeepb02/awesome-erc8004

### Support & Communaute
- Telegram SKALE Builders (support dev) : https://t.me/+dDdvu5T6BOEzZDEx
- Support Google Cloud AP2 : godeva@google.com / jordanellis@google.com
- Virtuals Protocol (bonus bounties DeFi track) : https://github.com/Virtual-Protocol

### Outils Dev
- Hardhat : https://hardhat.org/docs
- ethers.js v6 : https://docs.ethers.org/v6/
- Hono (HTTP framework) : https://hono.dev/docs/
- Next.js 14 : https://nextjs.org/docs
- Tailwind CSS : https://tailwindcss.com/docs
- Anthropic Claude API : https://docs.anthropic.com/en/docs
- Vercel (deploy) : https://vercel.com/docs
- viem (alt wallet lib) : https://viem.sh/docs/getting-started

### npm Packages — Installation Rapide

```bash
# BITE v2
npm i @skalenetwork/bite @skalenetwork/bite-solidity

# x402
npm i @x402/core @x402/evm @x402/hono @hono/node-server hono

# ERC-8004 (optionnel)
npm i @agentic-trust/8004-ext-sdk
# ou scaffolding:
npx create-8004-agent

# AI
npm i @anthropic-ai/sdk

# Web
npm i next react react-dom ethers tailwindcss

# Dev
npm i -D hardhat @nomicfoundation/hardhat-toolbox typescript dotenv
```
