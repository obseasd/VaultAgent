import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const escrowId = searchParams.get("id");

    if (!escrowId) {
      return NextResponse.json(
        { error: "Missing escrow id" },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    if (!contractAddress) {
      return NextResponse.json(
        { error: "Contract not configured" },
        { status: 500 }
      );
    }

    const abi = [
      "function getEscrow(uint256 id) external view returns (tuple(address buyer, address seller, uint256 amount, uint8 status, uint256 createdAt, uint256 timeout, bytes32 conditionHash, string receiptURI, bool decrypted))",
      "function escrowCount() external view returns (uint256)",
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);
    const escrow = await contract.getEscrow(escrowId);

    const statusLabels: Record<number, string> = {
      0: "Active",
      1: "Released",
      2: "Refunded",
      3: "Disputed",
    };

    return NextResponse.json({
      id: escrowId,
      buyer: escrow.buyer,
      seller: escrow.seller,
      amount: ethers.formatEther(escrow.amount),
      status: Number(escrow.status),
      statusLabel: statusLabels[Number(escrow.status)] || "Unknown",
      createdAt: Number(escrow.createdAt),
      timeout: Number(escrow.timeout),
      conditionHash: escrow.conditionHash,
      receiptURI: escrow.receiptURI,
      decrypted: escrow.decrypted,
    });
  } catch (error: any) {
    console.error("Escrow status API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch status" },
      { status: 500 }
    );
  }
}
