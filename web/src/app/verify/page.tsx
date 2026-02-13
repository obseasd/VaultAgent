"use client";

import { Suspense, useState } from "react";
import { ethers } from "ethers";
import { useSearchParams } from "next/navigation";
import {
  VAULT_ESCROW_ADDRESS,
  VAULT_ESCROW_ABI,
  EXPLORER_URL,
} from "@/lib/contract";

interface VerificationResult {
  passed: boolean;
  confidence: number;
  reason: string;
  details: string[];
  timestamp?: string;
}

interface AuditEntry {
  time: string;
  action: string;
  status: "pending" | "success" | "error";
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-12 text-gray-400">Loading...</div>}>
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
    setAudit((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), action, status },
    ]);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setAudit([]);
    setLoading(true);

    try {
      addAudit("Submitting proof for AI verification", "pending");

      // Load escrow context from chain
      if (!(window as any).ethereum) throw new Error("No wallet");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        provider
      );

      const escrow = await contract.getEscrow(parseInt(escrowId));
      addAudit(
        `Loaded escrow #${escrowId} from chain`,
        "success"
      );

      const context = {
        amount: ethers.formatEther(escrow.amount),
        buyer: escrow.buyer,
        seller: escrow.seller,
      };

      addAudit("Sending to AI agent for condition analysis", "pending");

      // Call the verification API
      const response = await fetch("/api/verify-condition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId, condition, proof, context }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }

      const verResult: VerificationResult = await response.json();
      setResult(verResult);

      addAudit(
        `AI verdict: ${verResult.passed ? "PASSED" : "FAILED"} (${verResult.confidence}% confidence)`,
        verResult.passed ? "success" : "error"
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Verification failed");
      addAudit(`Error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    setReleasing(true);
    setError("");
    try {
      addAudit("Initiating escrow release on-chain", "pending");

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        signer
      );

      const receiptURI = `vaultagent://receipt/${escrowId}/${Date.now()}`;
      const tx = await contract.releaseEscrow(parseInt(escrowId), receiptURI, {
        gasLimit: 200000,
      });

      addAudit(`Transaction sent: ${tx.hash.slice(0, 16)}...`, "pending");
      await tx.wait();
      setReleaseTxHash(tx.hash);

      addAudit("Escrow released! Funds transferred to seller.", "success");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Release failed");
      addAudit(`Release error: ${err.message}`, "error");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">
        Submit Proof & Verify
      </h1>
      <p className="text-gray-400 mb-8">
        Submit delivery proof for AI verification. If the condition is met, the
        escrow releases automatically.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="glass p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Verification Request
            </h2>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Escrow ID
                </label>
                <input
                  type="number"
                  className="input-glass"
                  placeholder="1"
                  value={escrowId}
                  onChange={(e) => setEscrowId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Condition Description
                </label>
                <textarea
                  className="input-glass min-h-[80px]"
                  placeholder="Describe the condition that was agreed upon..."
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Proof of Delivery
                </label>
                <textarea
                  className="input-glass min-h-[120px]"
                  placeholder="Provide evidence that the condition has been met (URLs, descriptions, screenshots, logs...)"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="glass p-3 border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-glow w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Analyzing with AI...
                  </span>
                ) : (
                  "Request AI Verification"
                )}
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div className="glass p-6 mt-6">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    result.passed
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {result.passed ? (
                    <svg
                      className="w-7 h-7"
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
                  ) : (
                    <svg
                      className="w-7 h-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {result.passed
                      ? "Condition Verified"
                      : "Condition Not Met"}
                  </h3>
                  <p className="text-gray-400 text-sm">{result.reason}</p>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Confidence</span>
                  <span>{result.confidence}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      result.passed ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
              </div>

              {/* Details */}
              {result.details.length > 0 && (
                <div className="space-y-2 mb-4">
                  <span className="text-sm text-gray-400">Details:</span>
                  {result.details.map((d, i) => (
                    <div
                      key={i}
                      className="glass p-3 text-sm text-gray-300"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}

              {/* Release button */}
              {result.passed && !releaseTxHash && (
                <button
                  onClick={handleRelease}
                  disabled={releasing}
                  className="btn-glow w-full mt-4"
                >
                  {releasing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Releasing payment...
                    </span>
                  ) : (
                    "Release Payment"
                  )}
                </button>
              )}

              {releaseTxHash && (
                <div className="glass p-4 mt-4 border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <svg
                      className="w-5 h-5"
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
                    <span className="font-bold">Payment Released!</span>
                  </div>
                  <a
                    href={`${EXPLORER_URL}/tx/${releaseTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vault-400 text-sm font-mono hover:underline break-all"
                  >
                    {releaseTxHash}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Trail */}
        <div className="lg:col-span-2">
          <div className="glass p-6 sticky top-24">
            <h2 className="text-lg font-bold text-white mb-4">Audit Trail</h2>
            {audit.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Submit a proof to see the verification audit trail.
              </p>
            ) : (
              <div className="space-y-3">
                {audit.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        entry.status === "success"
                          ? "bg-emerald-400"
                          : entry.status === "error"
                            ? "bg-red-400"
                            : "bg-yellow-400 animate-pulse"
                      }`}
                    />
                    <div>
                      <p className="text-sm text-gray-300">{entry.action}</p>
                      <p className="text-xs text-gray-600">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Privacy explainer */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 mb-3">
                Privacy Info
              </h3>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-vault-600/20 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-vault-400"
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
                  </span>
                  <span>Amount stays encrypted until release</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                  </span>
                  <span>AI verification triggers decryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span>All steps logged with timestamps</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
