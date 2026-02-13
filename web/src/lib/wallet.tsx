"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL, CHAIN_NAME, EXPLORER_URL } from "./contract";

interface WalletState {
  address: string;
  connected: boolean;
  connect: () => Promise<ethers.JsonRpcSigner | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: "",
  connected: false,
  connect: async () => null,
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState("");

  const connect = useCallback(async (): Promise<ethers.JsonRpcSigner | null> => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask");
      return null;
    }
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
            params: [
              {
                chainId: "0x" + CHAIN_ID.toString(16),
                chainName: CHAIN_NAME,
                nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: [EXPLORER_URL],
              },
            ],
          });
        } else {
          return null;
        }
      }
    }

    const signer = await provider.getSigner();
    setAddress(await signer.getAddress());
    return signer;
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connected: !!address, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
