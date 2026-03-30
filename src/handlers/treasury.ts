import {
  AllocationCreated as AllocationCreatedEvent,
  AllocationClosed as AllocationClosedEvent,
  WithdrawalQueued as WithdrawalQueuedEvent,
  WithdrawalExecuted as WithdrawalExecutedEvent,
  WithdrawalCanceled as WithdrawalCanceledEvent,
  ETHDeposited as ETHDepositedEvent,
  TokenDeposited as TokenDepositedEvent,
  EmergencySweep as EmergencySweepEvent,
} from "../../generated/TAGITTreasury/TAGITTreasury";
import {
  TreasuryAllocation,
  TreasuryWithdrawal,
  TreasuryDeposit,
  TreasuryEmergencySweep,
  TreasurySummary,
} from "../../generated/schema";
import { Bytes } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../helpers/constants";

const TREASURY_SUMMARY_ID = "treasury";

function getOrCreateTreasurySummary(): TreasurySummary {
  let summary = TreasurySummary.load(TREASURY_SUMMARY_ID);
  if (summary == null) {
    summary = new TreasurySummary(TREASURY_SUMMARY_ID);
    summary.totalAllocations = 0;
    summary.activeAllocations = 0;
    summary.totalAllocatedAmount = ZERO_BI;
    summary.totalSpentAmount = ZERO_BI;
    summary.totalDeposits = 0;
    summary.totalDepositedAmount = ZERO_BI;
    summary.totalWithdrawals = 0;
    summary.totalWithdrawalsPending = 0;
    summary.totalWithdrawalsExecuted = 0;
    summary.totalWithdrawalsCanceled = 0;
  }
  return summary;
}

export function handleAllocationCreated(event: AllocationCreatedEvent): void {
  let id = event.params.allocationId.toString();

  let allocation = new TreasuryAllocation(id);
  allocation.allocationId = event.params.allocationId;
  allocation.programId = event.params.programId;
  allocation.recipient = event.params.recipient;
  allocation.amount = event.params.amount;
  allocation.spent = ZERO_BI;
  allocation.expiresAt = event.params.expiresAt;
  allocation.active = true;
  allocation.createdAt = event.block.timestamp;
  allocation.createdAtBlock = event.block.number;
  allocation.closedAt = null;
  allocation.transactionHash = event.transaction.hash;
  allocation.save();

  let summary = getOrCreateTreasurySummary();
  summary.totalAllocations += 1;
  summary.activeAllocations += 1;
  summary.totalAllocatedAmount = summary.totalAllocatedAmount.plus(
    event.params.amount
  );
  summary.save();
}

export function handleAllocationClosed(event: AllocationClosedEvent): void {
  let allocation = TreasuryAllocation.load(
    event.params.allocationId.toString()
  );
  if (allocation == null) return;

  allocation.active = false;
  allocation.closedAt = event.block.timestamp;
  allocation.save();

  let summary = getOrCreateTreasurySummary();
  summary.activeAllocations -= 1;
  summary.save();
}

export function handleWithdrawalQueued(event: WithdrawalQueuedEvent): void {
  let id = event.params.withdrawalId.toString();

  let withdrawal = new TreasuryWithdrawal(id);
  withdrawal.withdrawalId = event.params.withdrawalId;
  withdrawal.allocationId = event.params.allocationId;
  withdrawal.to = event.params.to;
  withdrawal.token = event.params.token;
  withdrawal.amount = event.params.amount;
  withdrawal.executesAt = event.params.executesAt;
  withdrawal.status = "PENDING";
  withdrawal.queuedAt = event.block.timestamp;
  withdrawal.queuedAtBlock = event.block.number;
  withdrawal.executedAt = null;
  withdrawal.canceledAt = null;
  withdrawal.canceledBy = null;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.save();

  let summary = getOrCreateTreasurySummary();
  summary.totalWithdrawals += 1;
  summary.totalWithdrawalsPending += 1;
  summary.save();
}

export function handleWithdrawalExecuted(
  event: WithdrawalExecutedEvent
): void {
  let withdrawal = TreasuryWithdrawal.load(
    event.params.withdrawalId.toString()
  );
  if (withdrawal == null) return;

  withdrawal.status = "EXECUTED";
  withdrawal.executedAt = event.block.timestamp;
  withdrawal.save();

  // Update allocation spent
  let allocation = TreasuryAllocation.load(
    withdrawal.allocationId.toString()
  );
  if (allocation != null) {
    allocation.spent = allocation.spent.plus(event.params.amount);
    allocation.save();
  }

  let summary = getOrCreateTreasurySummary();
  summary.totalWithdrawalsPending -= 1;
  summary.totalWithdrawalsExecuted += 1;
  summary.totalSpentAmount = summary.totalSpentAmount.plus(
    event.params.amount
  );
  summary.save();
}

export function handleWithdrawalCanceled(
  event: WithdrawalCanceledEvent
): void {
  let withdrawal = TreasuryWithdrawal.load(
    event.params.withdrawalId.toString()
  );
  if (withdrawal == null) return;

  withdrawal.status = "CANCELED";
  withdrawal.canceledAt = event.block.timestamp;
  withdrawal.canceledBy = event.params.canceledBy;
  withdrawal.save();

  let summary = getOrCreateTreasurySummary();
  summary.totalWithdrawalsPending -= 1;
  summary.totalWithdrawalsCanceled += 1;
  summary.save();
}

export function handleETHDeposited(event: ETHDepositedEvent): void {
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();

  let deposit = new TreasuryDeposit(eventId);
  deposit.token = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000"
  );
  deposit.from = event.params.from;
  deposit.amount = event.params.amount;
  deposit.isETH = true;
  deposit.timestamp = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  let summary = getOrCreateTreasurySummary();
  summary.totalDeposits += 1;
  summary.totalDepositedAmount = summary.totalDepositedAmount.plus(
    event.params.amount
  );
  summary.save();
}

export function handleTokenDeposited(event: TokenDepositedEvent): void {
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();

  let deposit = new TreasuryDeposit(eventId);
  deposit.token = event.params.token;
  deposit.from = event.params.from;
  deposit.amount = event.params.amount;
  deposit.isETH = false;
  deposit.timestamp = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  let summary = getOrCreateTreasurySummary();
  summary.totalDeposits += 1;
  summary.totalDepositedAmount = summary.totalDepositedAmount.plus(
    event.params.amount
  );
  summary.save();
}

export function handleEmergencySweep(event: EmergencySweepEvent): void {
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();

  let sweep = new TreasuryEmergencySweep(eventId);
  sweep.token = event.params.token;
  sweep.to = event.params.to;
  sweep.amount = event.params.amount;
  sweep.signerCount = event.params.signerCount;
  sweep.timestamp = event.block.timestamp;
  sweep.blockNumber = event.block.number;
  sweep.transactionHash = event.transaction.hash;
  sweep.save();
}
