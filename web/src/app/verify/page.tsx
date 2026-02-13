"use client";

import { Suspense, useState } from "react";
import { ethers } from "ethers";
import { useSearchParams } from "next/navigation";
import { VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, EXPLORER_URL } from "@/lib/contract";

interface VerificationResult {
  passed: boolean; confidence: number; reason: string; details: string[];
}
interface AuditEntry {
  time: string; action: string; status: "pending" | "success" | "error";
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12 text-[var(--text-3)]">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const [escrowId, setEscrowId] = useState(searchParams.get("escrowId") || "");
  const [condition, setCondition] = useState("");
  const [proof, setProof] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseTxHash, setReleaseTxHash] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");

  function addAudit(action: string, status: AuditEntry["status"]) {
    setAudit((prev) => [...prev, { time: new Date().toLocaleTimeString(), action, status }]);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setResult(null); setAudit([]); setLoading(true);
    try {
      addAudit("Submitting proof for AI verification", "pending");
      if (!(window as any).ethereum) throw new Error("No wallet");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, provider);
      const escrow = await contract.getEscrow(parseInt(escrowId));
      addAudit(`Loaded escrow #${escrowId} from chain`, "success");
      const context = { amount: ethers.formatEther(escrow.amount), buyer: escrow.buyer, seller: escrow.seller };
      addAudit("Sending to AI agent for analysis", "pending");
      const response = await fetch("/api/verify-condition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId, condition, proof, context }),
      });
      if (!response.ok) throw new Error(`Verification failed: ${response.statusText}`);
      const verResult: VerificationResult = await response.json();
      setResult(verResult);
      addAudit(`AI verdict: ${verResult.passed ? "PASSED" : "FAILED"} (${verResult.confidence}%)`, verResult.passed ? "success" : "error");
    } catch (err: any) {
      setError(err.message || "Verification failed");
      addAudit(`Error: ${err.message}`, "error");
    } finally { setLoading(false); }
  }

  async function handleRelease() {
    setReleasing(true); setError("");
    try {
      addAudit("Releasing escrow on-chain", "pending");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, signer);
      const receiptURI = `vaultagent://receipt/${escrowId}/${Date.now()}`;
      const tx = await contract.releaseEscrow(parseInt(escrowId), receiptURI, { gasLimit: 200000 });
      addAudit(`Tx sent: ${tx.hash.slice(0, 16)}...`, "pending");
      await tx.wait();
      setReleaseTxHash(tx.hash);
      addAudit("Escrow released! Funds sent to seller.", "success");
    } catch (err: any) {
      setError(err.message || "Release failed");
      addAudit(`Release error: ${err.message}`, "error");
    } finally { setReleasing(false); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text-1)] mb-1">Verify & Release</h1>
      <p className="text-[var(--text-3)] text-sm mb-6">Submit delivery proof. AI verifies conditions, then releases the escrow.</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Form + Result */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[var(--text-1)] mb-4">Verification Request</h2>
            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-3)] mb-1.5 block">Escrow ID</label>
                <input type="number" className="input-field" placeholder="1" value={escrowId} onChange={(e) => setEscrowId(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-[var(--text-3)] mb-1.5 block">Condition Description</label>
                <textarea className="input-field" placeholder="What was agreed upon..." value={condition} onChange={(e) => setCondition(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-[var(--text-3)] mb-1.5 block">Proof of Delivery</label>
                <textarea className="input-field" style={{ minHeight: "100px" }} placeholder="URLs, descriptions, logs..." value={proof} onChange={(e) => setProof(e.target.value)} required />
              </div>
              {error && <div className="card-inner p-3 !border-[rgba(248,113,113,0.2)]"><p className="text-[var(--red)] text-sm">{error}</p></div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="flex items-center justify-center gap-2"><span className="spinner" /> Analyzing...</span> : "Request AI Verification"}
              </button>
            </form>
          </div>

          {/* Result card */}
          {result && (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${result.passed ? "bg-[rgba(52,211,153,0.1)]" : "bg-[rgba(248,113,113,0.1)]"}`}>
                  {result.passed ? (
                    <svg className="w-6 h-6 text-[var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-6 h-6 text-[var(--red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-1)]">{result.passed ? "Condition Verified" : "Condition Not Met"}</h3>
                  <p className="text-sm text-[var(--text-3)]">{result.reason}</p>
                </div>
              </div>

              {/* Confidence */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--text-3)] mb-1">
                  <span>Confidence</span><span>{result.confidence}%</span>
                </div>
                <div className="conf-track">
                  <div className={`conf-fill ${result.passed ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} style={{ width: `${result.confidence}%` }} />
                </div>
              </div>

              {result.details.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {result.details.map((d, i) => (
                    <div key={i} className="card-inner p-3 text-sm text-[var(--text-2)]">{d}</div>
                  ))}
                </div>
              )}

              {result.passed && !releaseTxHash && (
                <button onClick={handleRelease} disabled={releasing} className="btn-primary">
                  {releasing ? <span className="flex items-center justify-center gap-2"><span className="spinner" /> Releasing...</span> : "Release Payment"}
                </button>
              )}

              {releaseTxHash && (
                <div className="card-inner p-4 !border-[rgba(52,211,153,0.2)]">
                  <div className="flex items-center gap-2 text-[var(--green)] mb-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="font-semibold text-sm">Payment Released</span>
                  </div>
                  <a href={`${EXPLORER_URL}/tx/${releaseTxHash}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] text-xs font-mono hover:underline break-all">{releaseTxHash}</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Audit trail */}
        <div className="lg:col-span-2">
          <div className="card p-5 lg:sticky lg:top-[88px]">
            <h2 className="text-sm font-semibold text-[var(--text-1)] mb-4">Audit Trail</h2>
            {audit.length === 0 ? (
              <p className="text-[var(--text-3)] text-xs">Submit a proof to see the verification audit trail.</p>
            ) : (
              <div className="space-y-3">
                {audit.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`step-dot mt-1.5 ${entry.status === "success" ? "step-done" : entry.status === "error" ? "step-error" : "step-active"}`} />
                    <div>
                      <p className="text-xs text-[var(--text-2)] leading-relaxed">{entry.action}</p>
                      <p className="text-[0.65rem] text-[var(--text-3)]">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-[var(--surface-3)]">
              <h3 className="text-xs font-semibold text-[var(--text-3)] mb-2.5">Privacy</h3>
              <div className="space-y-2 text-[0.7rem] text-[var(--text-3)]">
                <div className="flex items-center gap-2">
                  <span className="step-dot" style={{ background: "var(--accent)" }} />
                  Amount encrypted until release
                </div>
                <div className="flex items-center gap-2">
                  <span className="step-dot" style={{ background: "var(--green)" }} />
                  AI verification triggers decrypt
                </div>
                <div className="flex items-center gap-2">
                  <span className="step-dot" style={{ background: "var(--amber)" }} />
                  All steps logged on-chain
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
