import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

interface VerifyRequest {
  condition: string;
  proof: string;
  context: {
    amount: string;
    buyer: string;
    seller: string;
  };
}

export async function requestVerification(req: VerifyRequest) {
  const response = await fetch(`${AGENT_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`Verification failed: ${response.statusText}`);
  }

  return response.json();
}

// CLI usage
if (require.main === module) {
  const demo = async () => {
    console.log("Testing VaultAgent verification...\n");

    const result = await requestVerification({
      condition: "Deliver a working REST API with user authentication endpoints",
      proof:
        "Deployed API at https://api.example.com with /auth/login, /auth/register, /auth/logout endpoints. All return proper JSON responses. Auth uses JWT tokens with 24h expiry. Tested with Postman — all 3 endpoints return 200 OK.",
      context: {
        amount: "1.0",
        buyer: "0x1234...buyer",
        seller: "0x5678...seller",
      },
    });

    console.log("Verification result:", JSON.stringify(result, null, 2));
  };

  demo().catch(console.error);
}
