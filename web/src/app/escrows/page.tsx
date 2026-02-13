"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import {
  VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, EXPLORER_URL,
} from "@/lib/contract";

interface EscrowData {
  id: number; buyer: string; seller: string; amount: string;
  status: number; createdAt: number; timeout: number;
  conditionHash: string; receiptURI: string; decrypted: boolean;
}

const STATUS_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: "Active", cls: "badge-active" },
  1: { label: "Released", cls: "badge-released" },
  2: { label: "Refunded", cls: "badge-refunded" },
  3: { label: "Disputed", cls: "badge-disputed" },
};

export default function EscrowsPage() {
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadEscrows = useCallback(async () => {
    try {
      if (!(window as any).ethereum) return;
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      const contract = new ethers.Contract(VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, provider);
      const count = await contract.escrowCount();
      const items: EscrowData[] = [];
      for (let i = 1; i <= Number(count); i++) {
        const e = await contract.getEscrow(i);
        if (e.buyer.toLowerCase() === accounts[0].toLowerCase() || e.seller.toLowerCase() === accounts[0].toLowerCase()) {
          items.push({ id: i, buyer: e.buyer, seller: e.seller, amount: ethers.formatEther(e.amount), status: Number(e.status), createdAt: Number(e.createdAt), timeout: Number(e.timeout), conditionHash: e.conditionHash, receiptURI: e.receiptURI, decrypted: e.decrypted });
        }
      }
      setEscrows(items.reverse());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEscrows(); }, [loadEscrows]);

  async function handleAction(escrowId: number, action: "refund" | "dispute") {
    setActionLoading(escrowId);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_ESCROW_ADDRESS, VAULT_ESCROW_ABI, signer);
      const tx = action === "refund"
        ? await contract.claimRefund(escrowId, { gasLimit: 200000 })
        : await contract.dispute(escrowId, { gasLimit: 200000 });
      await tx.wait();
      await loadEscrows();
    } catch (err: any) { alert(err.reason || err.message); } finally { setActionLoading(null); }
  }

  function timeLeft(created: number, timeout: number) {
    const remaining = (created + timeout) - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return "Expired";
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-1)]">My Escrows</h1>
        {account && (
          <span className="text-xs font-mono text-[var(--text-3)] bg-[var(--surface-2)] rounded-2xl px-3 py-1.5">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <span className="spinner mx-auto block mb-3" />
          <p className="text-[var(--text-3)] text-sm">Loading escrows...</p>
        </div>
      ) : escrows.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-10 h-10 text-[var(--surface-4)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-[var(--text-1)] font-medium mb-1">No escrows yet</p>
          <p className="text-[var(--text-3)] text-sm">Create your first encrypted escrow to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map((e) => (
            <div key={e.id} className="card p-5 hover-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-bold text-[var(--text-1)]">#{e.id}</span>
                  <span className={`badge ${STATUS_BADGE[e.status].cls}`}>{STATUS_BADGE[e.status].label}</span>
                  {!e.decrypted && e.status === 0 && <span className="badge badge-encrypted">Encrypted</span>}
                </div>
                <span className="text-xs text-[var(--text-3)]">
                  {e.status === 0 ? timeLeft(e.createdAt, e.timeout) : "--"}
                </span>
              </div>

              <div className="card-inner p-3">
                <div className="detail-row">
                  <span className="detail-label">Amount</span>
                  <span className="detail-value font-mono text-sm">{e.decrypted ? `${e.amount} sFUEL` : "Encrypted"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Buyer</span>
                  <span className="text-xs font-mono text-[var(--text-2)]">{e.buyer.slice(0, 8)}...{e.buyer.slice(-6)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Seller</span>
                  <span className="text-xs font-mono text-[var(--text-2)]">{e.seller.slice(0, 8)}...{e.seller.slice(-6)}</span>
                </div>
                {e.receiptURI && (
                  <div className="detail-row">
                    <span className="detail-label">Receipt</span>
                    <a href={e.receiptURI} target="_blank" rel="noopener noreferrer" className="text-[var(--pink)] text-xs hover:underline">{e.receiptURI.slice(0, 30)}...</a>
                  </div>
                )}
              </div>

              {e.status === 0 && (
                <div className="flex gap-2 mt-3 justify-end">
                  {e.buyer.toLowerCase() === account.toLowerCase() && (
                    <>
                      <button onClick={() => handleAction(e.id, "refund")} disabled={actionLoading === e.id} className="btn-ghost">Claim Refund</button>
                      <button onClick={() => handleAction(e.id, "dispute")} disabled={actionLoading === e.id} className="btn-ghost !text-[var(--red)] !border-[rgba(255,67,67,0.2)] hover:!border-[rgba(255,67,67,0.4)]">Dispute</button>
                    </>
                  )}
                  {e.seller.toLowerCase() === account.toLowerCase() && (
                    <Link href={`/verify?escrowId=${e.id}`} className="btn-accent">Submit Proof</Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
