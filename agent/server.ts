import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { verifyCondition } from "./agent";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const app = new Hono();

app.use("/*", cors());

// ---------- x402 Payment Middleware Setup ----------

let x402Enabled = false;

async function setupX402() {
  try {
    const { paymentMiddleware } = await import("@x402/hono");
    const { ExactEvmScheme } = await import("@x402/evm/exact/server");
    const { HTTPFacilitatorClient, x402ResourceServer } = await import("@x402/core/server");

    const facilitatorUrl = process.env.FACILITATOR_URL || "https://facilitator.dirtroad.dev";
    const receivingAddress = process.env.RECEIVING_ADDRESS as `0x${string}`;
    const paymentToken = process.env.PAYMENT_TOKEN_ADDRESS || "0x61a26022927096f444994dA1e53F0FD9487EAfcf";
    const network = `eip155:${process.env.NEXT_PUBLIC_CHAIN_ID || "103698795"}`;

    if (!receivingAddress) {
      console.warn("[x402] No RECEIVING_ADDRESS set, x402 payment disabled");
      return;
    }

    const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    const resourceServer = new x402ResourceServer(facilitatorClient);
    resourceServer.register("eip155:*", new ExactEvmScheme());

    app.use(
      "/api/verify-paid",
      paymentMiddleware(
        {
          "POST /api/verify-paid": {
            accepts: [{
              scheme: "exact",
              network,
              payTo: receivingAddress,
              price: {
                amount: "10000",
                asset: paymentToken,
                extra: { name: "Axios USD", version: "1" },
              },
            }],
            description: "AI-powered escrow condition verification via VaultAgent",
            mimeType: "application/json",
          },
        },
        resourceServer,
      ),
    );

    x402Enabled = true;
    console.log("[x402] Payment middleware enabled on /api/verify-paid");
    console.log(`[x402] Network: ${network} | Pay to: ${receivingAddress}`);
  } catch (err: any) {
    console.warn("[x402] x402 packages not available, running without payment gate:", err.message);
  }
}

// ---------- Routes ----------

// Health check + service discovery
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "VaultAgent AI Verifier",
    x402: x402Enabled,
    endpoints: {
      free: "POST /api/verify",
      paid: x402Enabled ? "POST /api/verify-paid (x402 gated)" : "disabled",
    },
  });
});

// Free AI verification endpoint
app.post("/api/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { condition, proof, context } = body;

    if (!condition || !proof || !context) {
      return c.json({ error: "Missing condition, proof, or context" }, 400);
    }

    const result = await verifyCondition(condition, proof, {
      amount: context.amount || "0",
      buyer: context.buyer || "unknown",
      seller: context.seller || "unknown",
    });

    return c.json({
      ...result,
      timestamp: new Date().toISOString(),
      service: "VaultAgent AI Verifier",
      x402: false,
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// x402-gated paid verification endpoint
app.post("/api/verify-paid", async (c) => {
  try {
    const body = await c.req.json();
    const { condition, proof, context } = body;

    if (!condition || !proof || !context) {
      return c.json({ error: "Missing condition, proof, or context" }, 400);
    }

    const result = await verifyCondition(condition, proof, {
      amount: context.amount || "0",
      buyer: context.buyer || "unknown",
      seller: context.seller || "unknown",
    });

    return c.json({
      ...result,
      timestamp: new Date().toISOString(),
      service: "VaultAgent AI Verifier",
      x402: true,
      payment: "verified via x402 protocol",
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

// ---------- Start ----------

const port = parseInt(process.env.AGENT_PORT || "3001", 10);

async function start() {
  await setupX402();
  serve({ fetch: app.fetch, port });
  console.log(`\nVaultAgent AI server running at http://localhost:${port}`);
  console.log(`  POST /api/verify          — Free AI verification`);
  if (x402Enabled) {
    console.log(`  POST /api/verify-paid     — x402-gated (0.01 Axios USD)`);
  }
}

start();
