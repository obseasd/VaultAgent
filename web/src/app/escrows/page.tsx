"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  VAULT_ESCROW_ADDRESS,
  VAULT_ESCROW_ABI,
  CHAIN_ID,
  RPC_URL,
  EXPLORER_URL,
  ESCROW_STATUS_LABELS,
  ESCROW_STATUS_COLORS,
} from "@/lib/contract";

interface EscrowData {
  id: number;
  buyer: string;
  seller: string;
  amount: string;
  status: number;
  createdAt: number;
  timeout: number;
  conditionHash: string;
  receiptURI: string;
  decrypted: boolean;
}

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
      const userAddr = accounts[0];
      setAccount(userAddr);

      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        provider
      );

      const count = await contract.escrowCount();
      const items: EscrowData[] = [];

      for (let i = 1; i <= Number(count); i++) {
        const e = await contract.getEscrow(i);
        if (
          e.buyer.toLowerCase() === userAddr.toLowerCase() ||
          e.seller.toLowerCase() === userAddr.toLowerCase()
        ) {
          items.push({
            id: i,
            buyer: e.buyer,
            seller: e.seller,
            amount: ethers.formatEther(e.amount),
            status: Number(e.status),
            createdAt: Number(e.createdAt),
            timeout: Number(e.timeout),
            conditionHash: e.conditionHash,
            receiptURI: e.receiptURI,
            decrypted: e.decrypted,
          });
        }
      }

      setEscrows(items.reverse());
    } catch (err) {
      console.error("Failed to load escrows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscrows();
  }, [loadEscrows]);

  async function handleRefund(escrowId: number) {
    setActionLoading(escrowId);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        signer
      );
      const tx = await contract.claimRefund(escrowId, { gasLimit: 200000 });
      await tx.wait();
      await loadEscrows();
    } catch (err: any) {
      alert(err.message || "Refund failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDispute(escrowId: number) {
    setActionLoading(escrowId);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        VAULT_ESCROW_ADDRESS,
        VAULT_ESCROW_ABI,
        signer
      );
      const tx = await contract.dispute(escrowId, { gasLimit: 200000 });
      await tx.wait();
      await loadEscrows();
    } catch (err: any) {
      alert(err.message || "Dispute failed");
    } finally {
      setActionLoading(null);
    }
  }

  function timeRemaining(createdAt: number, timeout: number): string {
    const deadline = createdAt + timeout;
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${mins}m remaining`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Escrows</h1>
          <p className="text-gray-400 mt-1">
            Manage your active and past escrows
          </p>
        </div>
        {account && (
          <div className="glass px-4 py-2 text-xs font-mono text-gray-400">
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-vault-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading escrows...</p>
        </div>
      ) : escrows.length === 0 ? (
        <div className="glass p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-vault-600/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-vault-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            No escrows yet
          </h3>
          <p className="text-gray-500">
            Create your first encrypted escrow to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escrows.map((e) => (
            <div key={e.id} className="glass p-6 glass-hover">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">
                      Escrow #{e.id}
                    </span>
                    <span
                      className={`badge ${ESCROW_STATUS_COLORS[e.status]}`}
                    >
                      {ESCROW_STATUS_LABELS[e.status]}
                    </span>
                    {!e.decrypted && e.status === 0 && (
                      <span className="badge text-yellow-400 bg-yellow-400/10 border-yellow-400/30 animate-encrypt">
                        Encrypted
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Amount: </span>
                      <span className="text-white font-mono">
                        {e.decrypted ? `${e.amount} sFUEL` : "Encrypted"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Timeout: </span>
                      <span className="text-white">
                        {e.status === 0
                          ? timeRemaining(e.createdAt, e.timeout)
                          : "--"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Buyer: </span>
                      <span className="text-white font-mono text-xs">
                        {e.buyer.slice(0, 8)}...{e.buyer.slice(-6)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Seller: </span>
                      <span className="text-white font-mono text-xs">
                        {e.seller.slice(0, 8)}...{e.seller.slice(-6)}
                      </span>
                    </div>
                  </div>

                  {e.receiptURI && (
                    <div className="text-sm">
                      <span className="text-gray-500">Receipt: </span>
                      <a
                        href={e.receiptURI}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-vault-400 hover:underline"
                      >
                        {e.receiptURI}
                      </a>
                    </div>
                  )}
                </div>

                {e.status === 0 && (
                  <div className="flex gap-2">
                    {e.buyer.toLowerCase() === account.toLowerCase() && (
                      <>
                        <button
                          onClick={() => handleRefund(e.id)}
                          disabled={actionLoading === e.id}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 transition-colors disabled:opacity-50"
                        >
                          Claim Refund
                        </button>
                        <button
                          onClick={() => handleDispute(e.id)}
                          disabled={actionLoading === e.id}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:border-red-500/60 transition-colors disabled:opacity-50"
                        >
                          Dispute
                        </button>
                      </>
                    )}
                    {e.seller.toLowerCase() === account.toLowerCase() && (
                      <a
                        href={`/verify?escrowId=${e.id}`}
                        className="px-3 py-1.5 text-xs rounded-lg border border-vault-500/30 text-vault-400 hover:border-vault-500/60 transition-colors"
                      >
                        Submit Proof
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
