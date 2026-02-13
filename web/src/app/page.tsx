"use client";

import { useState } from "react";
import { ethers } from "ethers";
import {
  VAULT_ESCROW_ADDRESS,
  VAULT_ESCROW_ABI,
  CHAIN_ID,
  RPC_URL,
  CHAIN_NAME,
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
  const [showDetails, setShowDetails] = useState(false);

  async function connectWallet() {
    if (!(window as any).ethereum) { setError("Please install MetaMask"); return null; }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + CHAIN_ID.toString(16) }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0x" + CHAIN_ID.toString(16), chainName: CHAIN_NAME, nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER_URL] }],
          });
        } else { return null; }
      }
    }
    return await provider.getSigner();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("connecting");
    try {
      const signer = await connectWallet();
      if (!signer) { setStep("error"); return; }
      const signerAddr = await signer.getAddress();
      if (seller.toLowerCase() === signerAddr.toLowerCase()) {
        setError("Cannot create an escrow to yourself. Use a different seller address.");
        setStep("error");
        return;
      }
      setStep("encrypting");
      const amountWei = ethers.parseEther(amount);
      const encrypted = await encryptEscrowTerms(amountWei);
      const condHash = hashCondition(condition);
      setStep("sending");
      const contract = new ethers.Contract(VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, signer);
      const tx = await contract.createEscrow(seller, parseInt(timeout), condHash, ethers.toUtf8Bytes(encrypted), { value: ethers.parseEther("0.06"), gasLimit: 500000 });
      setTxHash(tx.hash);
      const receipt = await tx.wait();
      const iface = new ethers.Interface(VAULT_ESCROW_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "EscrowCreated") setEscrowId(parsed.args[0].toString());
        } catch {}
      }
      setStep("done");
    } catch (err: any) {
      setError(err.reason || err.message || "Transaction failed");
      setStep("error");
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-8 max-w-lg">
        <h1 className="text-[2.5rem] font-bold text-[var(--text-1)] leading-tight mb-3">
          Encrypted Escrow,<br /><span className="gradient-text">AI Verified</span>
        </h1>
        <p className="text-[var(--text-3)] text-base">
          Create conditional payments with encrypted terms on SKALE.
          An AI agent verifies delivery before releasing funds.
        </p>
      </div>

      {/* Main card */}
      <div className="card p-4 w-full max-w-[480px]">
        {step === "done" ? (
          <div className="py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(52,211,153,0.1)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-1)] mb-1">Escrow Created</h2>
            <p className="text-[var(--text-3)] text-sm mb-5">Escrow #{escrowId} is active with encrypted terms</p>
            <div className="card-inner p-4 text-left mb-5">
              <div className="detail-row"><span className="detail-label">Escrow ID</span><span className="detail-value font-mono">#{escrowId}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="badge badge-active">Active</span></div>
              <div className="detail-row"><span className="detail-label">Encryption</span><span className="badge badge-encrypted">BITE v2</span></div>
              <div className="detail-row">
                <span className="detail-label">Tx Hash</span>
                <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] text-xs font-mono hover:underline">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            </div>
            <button onClick={() => { setStep("idle"); setTxHash(""); setEscrowId(""); }} className="btn-primary">Create Another</button>
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text-1)]">New Escrow</h2>
              <div className="flex gap-1.5">
                <span className="badge badge-encrypted">Encrypted</span>
                <span className="badge badge-info">Zero Gas</span>
              </div>
            </div>

            {/* Amount */}
            <div className="card-inner p-4 mb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-3)]">Amount</span>
                <span className="text-xs text-[var(--text-3)]">Encrypted via BITE v2</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" step="0.001" className="input-big flex-1" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <div className="bg-[var(--surface-2)] rounded-2xl px-3 py-1.5 text-sm font-semibold text-[var(--text-1)] flex items-center gap-1.5 shrink-0">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--steel)] to-[var(--accent)]" />
                  sFUEL
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-[10px] relative z-10">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] border-4 border-[var(--surface-1)] flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Seller */}
            <div className="card-inner p-4 mb-3">
              <span className="text-xs text-[var(--text-3)] mb-1 block">Seller Address</span>
              <input type="text" className="input-big text-lg" placeholder="0x..." value={seller} onChange={(e) => setSeller(e.target.value)} required />
            </div>

            {/* Condition */}
            <div className="card-inner p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-3)]">Condition</span>
                <span className="text-xs text-[var(--text-3)]">Hashed on-chain</span>
              </div>
              <textarea className="input-big text-sm font-normal leading-relaxed" style={{ fontSize: "0.95rem", minHeight: "60px", resize: "vertical" }} placeholder="Describe what the seller must deliver..." value={condition} onChange={(e) => setCondition(e.target.value)} required />
            </div>

            {/* Expand details */}
            <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center justify-between w-full px-1 py-2 text-sm text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
              <span>Transaction details</span>
              <svg className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDetails && (
              <div className="card-inner p-3 mb-3">
                <div className="detail-row">
                  <span className="detail-label">Timeout</span>
                  <div className="flex items-center gap-2">
                    <input type="number" className="bg-transparent border-none text-right text-[var(--text-1)] font-medium text-sm w-20 outline-none" value={timeout} onChange={(e) => setTimeout_(e.target.value)} />
                    <span className="text-xs text-[var(--text-3)]">sec</span>
                  </div>
                </div>
                <div className="detail-row"><span className="detail-label">CTX Gas</span><span className="detail-value text-sm">0.06 sFUEL</span></div>
                <div className="detail-row"><span className="detail-label">Network</span><span className="detail-value text-sm">{CHAIN_NAME}</span></div>
                <div className="detail-row"><span className="detail-label">Privacy</span><span className="badge badge-encrypted text-[0.7rem]">Amount + Terms Encrypted</span></div>
              </div>
            )}

            {error && <div className="card-inner p-3 mb-3 !border-[var(--red)]/20"><p className="text-[var(--red)] text-sm">{error}</p></div>}

            {step !== "idle" && step !== "error" && (
              <div className="card-inner p-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="spinner" />
                  <span className="text-sm text-[var(--text-2)]">
                    {step === "connecting" && "Connecting wallet..."}
                    {step === "encrypting" && "Encrypting terms via BITE v2..."}
                    {step === "sending" && "Confirming transaction..."}
                  </span>
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary mt-1" disabled={step !== "idle" && step !== "error"}>
              {step === "idle" || step === "error" ? "Create Encrypted Escrow" : "Processing..."}
            </button>
          </form>
        )}
      </div>

      {/* Bottom info */}
      <div className="grid grid-cols-3 gap-3 mt-6 max-w-[480px] w-full">
        {[
          { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "Private", sub: "BITE v2 encrypted" },
          { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "AI Verified", sub: "Claude as judge" },
          { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: "Zero Gas", sub: "SKALE network" },
        ].map((c) => (
          <div key={c.title} className="card p-3 text-center hover-card">
            <svg className="w-5 h-5 text-[var(--accent)] mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
            </svg>
            <p className="text-xs font-semibold text-[var(--text-1)]">{c.title}</p>
            <p className="text-[0.65rem] text-[var(--text-3)]">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
