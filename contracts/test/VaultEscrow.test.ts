import { expect } from "chai";
import { ethers } from "hardhat";
import { VaultEscrow } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VaultEscrow", function () {
  let vault: VaultEscrow;
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let other: SignerWithAddress;

  const TIMEOUT = 3600; // 1 hour
  const CONDITION_HASH = ethers.keccak256(ethers.toUtf8Bytes("deliver product X"));
  const FAKE_ENCRYPTED = ethers.toUtf8Bytes("encrypted_data_placeholder");

  beforeEach(async function () {
    [buyer, seller, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VaultEscrow");
    vault = (await Factory.deploy()) as VaultEscrow;
    await vault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should start with escrowCount = 0", async function () {
      expect(await vault.escrowCount()).to.equal(0);
    });
  });

  describe("createEscrow", function () {
    it("should reject zero address seller", async function () {
      await expect(
        vault.createEscrow(ethers.ZeroAddress, TIMEOUT, CONDITION_HASH, FAKE_ENCRYPTED, {
          value: ethers.parseEther("0.06"),
        })
      ).to.be.revertedWith("Invalid seller");
    });

    it("should reject self-escrow", async function () {
      await expect(
        vault.createEscrow(buyer.address, TIMEOUT, CONDITION_HASH, FAKE_ENCRYPTED, {
          value: ethers.parseEther("0.06"),
        })
      ).to.be.revertedWith("Cannot escrow to self");
    });

    it("should reject zero timeout", async function () {
      await expect(
        vault.createEscrow(seller.address, 0, CONDITION_HASH, FAKE_ENCRYPTED, {
          value: ethers.parseEther("0.06"),
        })
      ).to.be.revertedWith("Timeout must be > 0");
    });

    it("should reject insufficient CTX gas", async function () {
      await expect(
        vault.createEscrow(seller.address, TIMEOUT, CONDITION_HASH, FAKE_ENCRYPTED, {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWith("Must send CTX gas payment");
    });
  });

  describe("releaseEscrow", function () {
    it("should revert if escrow not active", async function () {
      await expect(vault.releaseEscrow(999, "ipfs://receipt")).to.be.revertedWith("Not active");
    });
  });

  describe("claimRefund", function () {
    it("should revert if escrow not active", async function () {
      await expect(vault.claimRefund(999)).to.be.revertedWith("Not active");
    });
  });

  describe("dispute", function () {
    it("should revert if escrow not active", async function () {
      await expect(vault.dispute(999)).to.be.revertedWith("Not active");
    });
  });

  describe("getEscrow", function () {
    it("should return empty escrow for non-existent id", async function () {
      const e = await vault.getEscrow(999);
      expect(e.buyer).to.equal(ethers.ZeroAddress);
    });
  });
});
