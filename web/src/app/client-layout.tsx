"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletProvider, useWallet } from "@/lib/wallet";

function WalletButton() {
  const { address, connected, connect, disconnect } = useWallet();

  if (connected) {
    return (
      <button
        onClick={disconnect}
        className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-2xl px-4 py-2 text-sm font-mono text-[var(--text-1)] hover:border-[var(--surface-4)] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => connect()}
      className="bg-[rgba(255,0,122,0.08)] text-[var(--pink)] border border-[rgba(255,0,122,0.12)] rounded-2xl px-5 py-2.5 text-sm font-semibold hover:bg-[rgba(255,0,122,0.14)] transition-colors"
    >
      Connect Wallet
    </button>
  );
}

function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Create" },
    { href: "/escrows", label: "Escrows" },
    { href: "/verify", label: "Verify" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-1)] border-b border-[var(--surface-3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Left: Logo + nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--pink)] to-[var(--purple)] flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-white" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-lg font-bold gradient-text">VaultAgent</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1 bg-[var(--surface-2)] rounded-2xl p-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`nav-link ${pathname === l.href ? "!text-[var(--text-1)] !bg-[var(--surface-3)]" : ""}`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Wallet */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-3)] bg-[var(--surface-2)] rounded-2xl px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
              SKALE
            </div>
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
      <main className="pt-[72px] min-h-screen">{children}</main>
    </WalletProvider>
  );
}
