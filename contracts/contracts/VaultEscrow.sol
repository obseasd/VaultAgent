// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BITE} from "@skalenetwork/bite-solidity/BITE.sol";
import {IBiteSupplicant} from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

contract VaultEscrow is IBiteSupplicant {
    uint256 constant CTX_GAS_PAYMENT = 0.06 ether;

    enum EscrowStatus {
        Active,
        Released,
        Refunded,
        Disputed
    }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 timeout;
        bytes32 conditionHash;
        string receiptURI;
        bool decrypted;
    }

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    // Audit trail events
    event EscrowCreated(uint256 indexed id, address buyer, address seller, bytes32 conditionHash);
    event EscrowDecrypted(uint256 indexed id, uint256 amount);
    event EscrowReleased(uint256 indexed id, address seller, uint256 amount);
    event EscrowRefunded(uint256 indexed id, address buyer, uint256 amount);
    event EscrowDisputed(uint256 indexed id, address initiator);
    event ConditionVerified(uint256 indexed id, bool passed, string reason);

    /// @notice Create an encrypted escrow with terms hidden via BITE v2 CTX
    function createEscrow(
        address seller,
        uint256 timeout,
        bytes32 conditionHash,
        bytes calldata encryptedTerms
    ) external payable returns (uint256) {
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Cannot escrow to self");
        require(timeout > 0, "Timeout must be > 0");
        require(msg.value >= CTX_GAS_PAYMENT, "Must send CTX gas payment");

        escrowCount++;
        escrows[escrowCount] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: 0,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            timeout: timeout,
            conditionHash: conditionHash,
            receiptURI: "",
            decrypted: false
        });

        // Submit CTX for conditional decryption
        bytes[] memory encArgs = new bytes[](1);
        encArgs[0] = encryptedTerms;
        bytes[] memory plainArgs = new bytes[](1);
        plainArgs[0] = abi.encode(escrowCount);

        address payable callbackSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            200000,
            encArgs,
            plainArgs
        );
        // Pay for the CTX callback gas
        (bool sent, ) = callbackSender.call{value: CTX_GAS_PAYMENT}("");
        require(sent, "CTX gas payment failed");

        emit EscrowCreated(escrowCount, msg.sender, seller, conditionHash);
        return escrowCount;
    }

    /// @notice BITE callback — receives decrypted terms
    function onDecrypt(
        bytes[] calldata decryptedArgs,
        bytes[] calldata plaintextArgs
    ) external override {
        uint256 escrowId = abi.decode(plaintextArgs[0], (uint256));
        uint256 amount = abi.decode(decryptedArgs[0], (uint256));

        Escrow storage e = escrows[escrowId];
        require(e.buyer != address(0), "Escrow does not exist");
        require(!e.decrypted, "Already decrypted");

        e.amount = amount;
        e.decrypted = true;

        emit EscrowDecrypted(escrowId, amount);
    }

    /// @notice Release funds to seller after AI verifies condition
    function releaseEscrow(uint256 escrowId, string calldata receiptURI) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(e.decrypted, "Not decrypted yet");

        e.status = EscrowStatus.Released;
        e.receiptURI = receiptURI;

        (bool sent, ) = payable(e.seller).call{value: e.amount}("");
        require(sent, "Payment to seller failed");

        emit EscrowReleased(escrowId, e.seller, e.amount);
    }

    /// @notice Auto-refund if timeout expired
    function claimRefund(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(block.timestamp > e.createdAt + e.timeout, "Timeout not reached");
        require(msg.sender == e.buyer, "Not buyer");

        e.status = EscrowStatus.Refunded;
        (bool sent, ) = payable(e.buyer).call{value: e.amount}("");
        require(sent, "Refund to buyer failed");

        emit EscrowRefunded(escrowId, e.buyer, e.amount);
    }

    /// @notice Dispute an escrow (freezes it for arbitration)
    function dispute(uint256 escrowId) external {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Active, "Not active");
        require(msg.sender == e.buyer || msg.sender == e.seller, "Not party");

        e.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    /// @notice Get escrow details
    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }

    /// @notice Allow contract to receive sFUEL
    receive() external payable {}
}
