import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { escrowId } = body;

    if (!escrowId) {
      return NextResponse.json(
        { error: "Missing escrowId" },
        { status: 400 }
      );
    }

    // Fetch escrow data from chain
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
    ];

    const contract = new ethers.Contract(contractAddress, abi, provider);
    const escrow = await contract.getEscrow(escrowId);

    return NextResponse.json({
      id: escrowId,
      buyer: escrow.buyer,
      seller: escrow.seller,
      amount: ethers.formatEther(escrow.amount),
      status: Number(escrow.status),
      createdAt: Number(escrow.createdAt),
      timeout: Number(escrow.timeout),
      conditionHash: escrow.conditionHash,
      receiptURI: escrow.receiptURI,
      decrypted: escrow.decrypted,
    });
  } catch (error: any) {
    console.error("Create escrow API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
