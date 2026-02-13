import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "istanbul",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    biteSandbox: {
      url: "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 103698795,
    },
    skaleTestnet: {
      url: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 324705682,
    },
  },
};

export default config;
