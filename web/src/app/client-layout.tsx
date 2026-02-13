"use client";

import Link from "next/link";
import Image from "next/image";
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
      className="bg-[rgba(96,165,250,0.08)] text-[var(--accent)] border border-[rgba(96,165,250,0.15)] rounded-2xl px-5 py-2.5 text-sm font-semibold hover:bg-[rgba(96,165,250,0.14)] transition-colors"
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
              <Image src="/logo.png" alt="VaultAgent" width={36} height={36} className="rounded-lg" />
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
