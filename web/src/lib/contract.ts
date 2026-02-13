export const VAULT_ESCROW_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "103698795",
  10
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";

// Dynamically select explorer based on chain ID
export const EXPLORER_URL =
  CHAIN_ID === 103698795
    ? "https://base-sepolia-testnet-explorer.skalenodes.com:10032"
    : "https://base-sepolia-testnet-explorer.skalenodes.com";

export const CHAIN_NAME =
  CHAIN_ID === 103698795 ? "SKALE BITE V2 Sandbox" : "SKALE Base Sepolia";

export const VAULT_ESCROW_ABI = [
  "function createEscrow(address seller, uint256 timeout, bytes32 conditionHash, bytes calldata encryptedTerms) external payable returns (uint256)",
  "function releaseEscrow(uint256 escrowId, string calldata receiptURI) external",
  "function claimRefund(uint256 escrowId) external",
  "function dispute(uint256 escrowId) external",
  "function getEscrow(uint256 id) external view returns (tuple(address buyer, address seller, uint256 amount, uint8 status, uint256 createdAt, uint256 timeout, bytes32 conditionHash, string receiptURI, bool decrypted))",
  "function escrowCount() external view returns (uint256)",
  "event EscrowCreated(uint256 indexed id, address buyer, address seller, bytes32 conditionHash)",
  "event EscrowDecrypted(uint256 indexed id, uint256 amount)",
  "event EscrowReleased(uint256 indexed id, address seller, uint256 amount)",
  "event EscrowRefunded(uint256 indexed id, address buyer, uint256 amount)",
  "event EscrowDisputed(uint256 indexed id, address initiator)",
  "event ConditionVerified(uint256 indexed id, bool passed, string reason)",
] as const;

export const ESCROW_STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Released",
  2: "Refunded",
  3: "Disputed",
};

export const ESCROW_STATUS_COLORS: Record<number, string> = {
  0: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  1: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  2: "text-gray-400 bg-gray-400/10 border-gray-400/30",
  3: "text-red-400 bg-red-400/10 border-red-400/30",
};
