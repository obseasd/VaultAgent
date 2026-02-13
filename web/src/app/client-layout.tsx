"use client";

import Link from "next/link";
import { WalletProvider, useWallet } from "@/lib/wallet";

function WalletButton() {
  const { address, connected, connect, disconnect } = useWallet();

  if (connected) {
    return (
      <button
        onClick={disconnect}
        className="glass px-4 py-2 text-sm font-mono text-vault-400 hover:border-vault-500/40 transition-colors"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button onClick={() => connect()} className="btn-glow text-sm py-2 px-4">
      Connect Wallet
    </button>
  );
}

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-vault-600/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vault-500 to-vault-700 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            <span className="text-lg font-bold gradient-text">VaultAgent</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-vault-400 transition-colors"
            >
              Create
            </Link>
            <Link
              href="/escrows"
              className="text-sm text-gray-400 hover:text-vault-400 transition-colors"
            >
              My Escrows
            </Link>
            <Link
              href="/verify"
              className="text-sm text-gray-400 hover:text-vault-400 transition-colors"
            >
              Verify
            </Link>
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <Navbar />
      <main className="pt-20 min-h-screen">{children}</main>
    </WalletProvider>
  );
}
