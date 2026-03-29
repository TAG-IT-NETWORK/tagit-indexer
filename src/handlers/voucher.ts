import {
  EscrowCreated as EscrowCreatedEvent,
  EscrowReleased as EscrowReleasedEvent,
  EscrowCancelled as EscrowCancelledEvent,
  TrustedOracleUpdated,
} from "../../generated/VerificationEscrow/VerificationEscrow";
import {
  Escrow,
  EscrowCreated,
  EscrowReleased,
  EscrowCancelled,
  OracleUpdate,
} from "../../generated/schema";
import { getOrCreateProtocol } from "../helpers/protocol";

export function handleEscrowCreated(event: EscrowCreatedEvent): void {
  let escrowId = event.params.escrowId.toString();

  // Create mutable escrow entity
  let escrow = new Escrow(escrowId);
  escrow.escrowId = event.params.escrowId;
  escrow.assetId = event.params.assetId;
  escrow.buyer = event.params.buyer;
  escrow.seller = event.params.seller;
  escrow.amount = event.params.amount;
  escrow.status = "ACTIVE";
  escrow.createdAt = event.block.timestamp;
  escrow.createdAtBlock = event.block.number;
  escrow.releasedAt = null;
  escrow.cancelledAt = null;
  escrow.oracle = null;
  escrow.transactionHash = event.transaction.hash;
  escrow.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let created = new EscrowCreated(eventId);
  created.escrow = escrow.id;
  created.assetId = event.params.assetId;
  created.buyer = event.params.buyer;
  created.seller = event.params.seller;
  created.amount = event.params.amount;
  created.timestamp = event.block.timestamp;
  created.blockNumber = event.block.number;
  created.transactionHash = event.transaction.hash;
  created.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalEscrows += 1;
  protocol.totalEscrowVolume = protocol.totalEscrowVolume.plus(
    event.params.amount
  );
  protocol.save();
}

export function handleEscrowReleased(event: EscrowReleasedEvent): void {
  let escrow = Escrow.load(event.params.escrowId.toString());
  if (escrow == null) return;

  // Update mutable escrow
  escrow.status = "RELEASED";
  escrow.releasedAt = event.block.timestamp;
  escrow.oracle = event.params.oracle;
  escrow.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let released = new EscrowReleased(eventId);
  released.escrow = escrow.id;
  released.assetId = event.params.assetId;
  released.seller = event.params.seller;
  released.amount = event.params.amount;
  released.oracle = event.params.oracle;
  released.timestamp = event.block.timestamp;
  released.blockNumber = event.block.number;
  released.transactionHash = event.transaction.hash;
  released.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalEscrowsReleased += 1;
  protocol.save();
}

export function handleEscrowCancelled(event: EscrowCancelledEvent): void {
  let escrow = Escrow.load(event.params.escrowId.toString());
  if (escrow == null) return;

  // Update mutable escrow
  escrow.status = "CANCELLED";
  escrow.cancelledAt = event.block.timestamp;
  escrow.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let cancelled = new EscrowCancelled(eventId);
  cancelled.escrow = escrow.id;
  cancelled.assetId = event.params.assetId;
  cancelled.buyer = event.params.buyer;
  cancelled.amount = event.params.amount;
  cancelled.timestamp = event.block.timestamp;
  cancelled.blockNumber = event.block.number;
  cancelled.transactionHash = event.transaction.hash;
  cancelled.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalEscrowsCancelled += 1;
  protocol.save();
}

export function handleTrustedOracleUpdated(
  event: TrustedOracleUpdated
): void {
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let update = new OracleUpdate(eventId);
  update.previousOracle = event.params.previousOracle;
  update.newOracle = event.params.newOracle;
  update.timestamp = event.block.timestamp;
  update.blockNumber = event.block.number;
  update.transactionHash = event.transaction.hash;
  update.save();
}
