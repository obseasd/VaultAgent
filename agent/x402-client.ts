/**
 * x402 Payment Client — Agent-to-agent paid verification
 *
 * Demonstrates the x402 HTTP payment protocol:
 * 1. Client calls /api/verify-paid → gets 402 Payment Required
 * 2. x402 SDK reads payment requirements from response headers
 * 3. Client wallet signs EIP-712 payment authorization
 * 4. Client retries with X-Payment-Response header
 * 5. Facilitator verifies payment on-chain → server returns result
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

interface VerifyRequest {
  condition: string;
  proof: string;
  context: { amount: string; buyer: string; seller: string };
}

/** Free verification (no payment) */
export async function requestFreeVerification(req: VerifyRequest) {
  const response = await fetch(`${AGENT_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!response.ok) throw new Error(`Free verify failed: ${response.statusText}`);
  return response.json();
}

/** x402-gated paid verification */
export async function requestPaidVerification(req: VerifyRequest) {
  try {
    const { wrapFetchWithPayment } = await import("@x402/core");

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ||
      "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";
    const wallet = new ethers.Wallet(
      process.env.PRIVATE_KEY!,
      new ethers.JsonRpcProvider(rpcUrl)
    );

    const paymentFetch = wrapFetchWithPayment(fetch, wallet);
    const response = await paymentFetch(`${AGENT_URL}/api/verify-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });

    if (!response.ok) throw new Error(`Paid verify failed: ${response.statusText}`);
    return response.json();
  } catch (err: any) {
    console.error("[x402] Payment flow failed:", err.message);
    console.log("[x402] Falling back to free endpoint...");
    return requestFreeVerification(req);
  }
}

// CLI demo
if (require.main === module) {
  (async () => {
    console.log("=== VaultAgent x402 Payment Demo ===\n");

    const req: VerifyRequest = {
      condition: "Deliver a working REST API with user authentication",
      proof: "API deployed at https://api.example.com with /auth/login, /auth/register, /auth/logout. All return JSON. JWT auth with 24h expiry. Tested — 200 OK on all.",
      context: { amount: "1.0", buyer: "0x1234...buyer", seller: "0x5678...seller" },
    };

    console.log("1. Free endpoint...");
    try {
      console.log("   ", JSON.stringify(await requestFreeVerification(req), null, 2));
    } catch (e: any) { console.log("   Error:", e.message); }

    console.log("\n2. x402-gated endpoint...");
    try {
      console.log("   ", JSON.stringify(await requestPaidVerification(req), null, 2));
    } catch (e: any) { console.log("   Error:", e.message); }
  })();
}
