import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { verifyCondition } from "./agent";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const app = new Hono();

app.use("/*", cors());

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", service: "VaultAgent AI Verifier" });
});

// AI condition verification endpoint
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
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return c.json({ error: error.message || "Internal server error" }, 500);
  }
});

const port = parseInt(process.env.AGENT_PORT || "3001", 10);

console.log(`VaultAgent AI server starting on port ${port}...`);
serve({ fetch: app.fetch, port });
console.log(`VaultAgent AI server running at http://localhost:${port}`);
