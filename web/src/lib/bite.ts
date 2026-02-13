import { ethers } from "ethers";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";

/**
 * Encrypt escrow terms using BITE v2 SDK
 * The amount stays hidden on-chain until the CTX callback triggers onDecrypt
 */
export async function encryptEscrowTerms(amount: bigint): Promise<string> {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256"],
    [amount]
  );

  // Dynamic import for BITE SDK (client-side only)
  try {
    const { BITE } = await import("@skalenetwork/bite");
    const bite = new BITE(RPC_URL);
    const encrypted = await bite.encryptMessage(encoded);
    return encrypted;
  } catch (error) {
    console.warn(
      "BITE SDK not available, using fallback encoding for demo:",
      error
    );
    // Fallback: return hex-encoded data for demo purposes
    return encoded;
  }
}

/**
 * Wait for BITE decryption finality and retrieve decrypted data
 */
export async function getDecryptedData(txHash: string) {
  try {
    const { BITE } = await import("@skalenetwork/bite");
    const bite = new BITE(RPC_URL);
    // Wait for finality (~3s on SKALE)
    await new Promise((r) => setTimeout(r, 3000));
    return bite.getDecryptedTransactionData(txHash);
  } catch (error) {
    console.warn("BITE decryption fetch failed:", error);
    return null;
  }
}

/**
 * Hash a condition string for on-chain storage
 */
export function hashCondition(condition: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(condition));
}
