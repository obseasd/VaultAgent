import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying VaultEscrow with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "sFUEL");

  const VaultEscrow = await ethers.getContractFactory("VaultEscrow");
  const vault = await VaultEscrow.deploy({ gasLimit: 5000000 });
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("VaultEscrow deployed to:", address);
  console.log("\nUpdate your .env file:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
