"use client";

import { useState } from "react";
import { ethers } from "ethers";
import {
  VAULT_ESCROW_ADDRESS,
  VAULT_ESCROW_ABI,
  CHAIN_ID,
  RPC_URL,
  EXPLORER_URL,
} from "@/lib/contract";
import { encryptEscrowTerms, hashCondition } from "@/lib/bite";

type Step = "idle" | "connecting" | "encrypting" | "sending" | "done" | "error";

export default function HomePage() {
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [condition, setCondition] = useState("");
  const [timeout, setTimeout_] = useState("3600");
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState("");
  const [escrowId, setEscrowId] = useState("");
  const [error, setError] = useState("");

  async function connectWallet() {
    if (!(window as any).ethereum) {
      setError("Please install MetaMask");
      return null;
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x" + CHAIN_ID.toString(16),
              chainName: "SKALE BITE V2 Sandbox",
              nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
      } catch {
        setError("Please switch to SKALE BITE V2 Sandbox network");
        return null;
      }
    }
    const signer = await provider.getSigner();
    return signer;
  }

  async function handleCreateEscrow(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("connecting");

    try {
      const signer = await connectWallet();
      if (!signer) {
        setStep("error");
        return;
      }

      setStep("encrypting");
      const amountWei = ethers.parseEther(amount);
      const encrypted = await encryptEscrowTerms(amountWei);
      const condHash = hashCondition(condition);

      setStep("sending");
      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        signer
      );

      const tx = await contract.createEscrow(
        seller,
        parseInt(timeout),
        condHash,
        ethers.toUtf8Bytes(encrypted),
        {
          value: ethers.parseEther("0.06"),
          gasLimit: 500000,
        }
      );

      setTxHash(tx.hash);
      const receipt = await tx.wait();

      // Parse EscrowCreated event
      const iface = new ethers.Interface(VAULT_ESCROW_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "EscrowCreated") {
            setEscrowId(parsed.args[0].toString());
          }
        } catch {}
      }

      setStep("done");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Transaction failed");
      setStep("error");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">
          <span className="gradient-text">Encrypted Conditional Payments</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Create AI-verified escrows with encrypted terms on SKALE. Amounts and
          conditions stay hidden until the AI agent confirms delivery.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <span className="badge text-vault-400 bg-vault-400/10 border-vault-400/30">
            BITE v2
          </span>
          <span className="badge text-emerald-400 bg-emerald-400/10 border-emerald-400/30">
            Zero Gas
          </span>
          <span className="badge text-blue-400 bg-blue-400/10 border-blue-400/30">
            AI Verified
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        {[
          { step: "1", title: "Encrypt", desc: "Terms hidden via BITE v2" },
          { step: "2", title: "Deliver", desc: "Seller submits proof" },
          { step: "3", title: "Verify", desc: "AI checks conditions" },
          { step: "4", title: "Release", desc: "Automatic payment" },
        ].map((s) => (
          <div key={s.step} className="glass p-4 text-center glass-hover">
            <div className="w-8 h-8 rounded-full bg-vault-600/20 text-vault-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">
              {s.step}
            </div>
            <h3 className="font-semibold text-white text-sm">{s.title}</h3>
            <p className="text-gray-500 text-xs mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Create Escrow Form */}
      <div className="glass p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          Create Encrypted Escrow
        </h2>

        {step === "done" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Escrow Created!
            </h3>
            <p className="text-gray-400 mb-4">
              Escrow #{escrowId} is now active with encrypted terms.
            </p>
            <div className="glass p-4 text-left text-sm space-y-2 max-w-md mx-auto">
              <div>
                <span className="text-gray-500">Escrow ID:</span>{" "}
                <span className="text-vault-400 font-mono">{escrowId}</span>
              </div>
              <div>
                <span className="text-gray-500">Tx Hash:</span>{" "}
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vault-400 font-mono text-xs hover:underline break-all"
                >
                  {txHash}
                </a>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className="badge text-blue-400 bg-blue-400/10 border-blue-400/30">
                  Active
                </span>
              </div>
              <div>
                <span className="text-gray-500">Encryption:</span>{" "}
                <span className="text-emerald-400">
                  Terms encrypted via BITE v2
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setStep("idle");
                setTxHash("");
                setEscrowId("");
              }}
              className="btn-glow mt-6"
            >
              Create Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateEscrow} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Seller Address
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder="0x..."
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount (sFUEL)
                  <span className="text-vault-400 ml-1 text-xs">
                    encrypted
                  </span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  className="input-glass"
                  placeholder="1.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  className="input-glass"
                  placeholder="3600"
                  value={timeout}
                  onChange={(e) => setTimeout_(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Condition Description
                <span className="text-vault-400 ml-1 text-xs">
                  hashed on-chain
                </span>
              </label>
              <textarea
                className="input-glass min-h-[100px]"
                placeholder="Describe what the seller must deliver..."
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="glass p-3 border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {step !== "idle" && step !== "error" && (
              <div className="glass p-4 animate-pulse-glow">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-vault-400 border-t-transparent rounded-full" />
                  <span className="text-vault-300">
                    {step === "connecting" && "Connecting wallet..."}
                    {step === "encrypting" &&
                      "Encrypting terms via BITE v2..."}
                    {step === "sending" &&
                      "Sending encrypted transaction..."}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-glow w-full"
              disabled={step !== "idle" && step !== "error"}
            >
              {step === "idle" || step === "error"
                ? "Create Encrypted Escrow"
                : "Processing..."}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Requires 0.06 sFUEL for BITE CTX gas. Amount and conditions are
              encrypted on-chain.
            </p>
          </form>
        )}
      </div>

      {/* What stays private */}
      <div className="glass p-6 mt-8">
        <h3 className="text-lg font-bold text-white mb-4">
          What stays private?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded bg-vault-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-vault-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <span className="text-white font-medium">Payment Amount</span>
              <p className="text-gray-500 mt-1">
                Encrypted via BITE v2 until conditions are met
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded bg-vault-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-vault-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <span className="text-white font-medium">Escrow Terms</span>
              <p className="text-gray-500 mt-1">
                Only a hash is visible on-chain, full terms stay encrypted
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded bg-emerald-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <div>
              <span className="text-white font-medium">Public Audit</span>
              <p className="text-gray-500 mt-1">
                Buyer/seller addresses, status & timestamps are public
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
