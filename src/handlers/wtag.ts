import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Transfer,
  Approval,
  TokensMinted,
  TokensBurned,
  EmissionsAddressSet,
  ContractUpgraded,
} from "../../generated/TAGITToken/TAGITToken";
import {
  WTagAccount,
  WTagTransfer,
  WTagApproval,
  WTagMint,
  WTagBurn,
  WTagEmissionsConfig,
  WTagUpgrade,
} from "../../generated/schema";
import { ZERO_BI } from "../helpers/constants";
import { getOrCreateProtocol } from "../helpers/protocol";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getOrCreateWTagAccount(address: Address): WTagAccount {
  let id = address.toHexString();
  let account = WTagAccount.load(id);
  if (account == null) {
    account = new WTagAccount(id);
    account.address = address;
    account.balance = ZERO_BI;
    account.transfersSent = 0;
    account.transfersReceived = 0;
    account.save();
  }
  return account;
}

export function handleWTagTransfer(event: Transfer): void {
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let value = event.params.value;

  // Load or create accounts
  let fromAccount = getOrCreateWTagAccount(fromAddress);
  let toAccount = getOrCreateWTagAccount(toAddress);

  // Update balances (skip zero-address for mint/burn — those are separate events)
  if (fromAddress.toHexString() != ZERO_ADDRESS) {
    fromAccount.balance = fromAccount.balance.minus(value);
    fromAccount.transfersSent += 1;
    fromAccount.save();
  }

  if (toAddress.toHexString() != ZERO_ADDRESS) {
    toAccount.balance = toAccount.balance.plus(value);
    toAccount.transfersReceived += 1;
    toAccount.save();
  }

  // Create immutable Transfer record
  let transferId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let transfer = new WTagTransfer(transferId);
  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.value = value;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  // Update protocol aggregate
  let protocol = getOrCreateProtocol();
  protocol.wtagTotalTransfers += 1;
  protocol.save();
}

export function handleWTagApproval(event: Approval): void {
  let ownerAccount = getOrCreateWTagAccount(event.params.owner);

  let approvalId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let approval = new WTagApproval(approvalId);
  approval.owner = ownerAccount.id;
  approval.spender = event.params.spender;
  approval.value = event.params.value;
  approval.timestamp = event.block.timestamp;
  approval.blockNumber = event.block.number;
  approval.transactionHash = event.transaction.hash;
  approval.save();
}

export function handleTokensMinted(event: TokensMinted): void {
  let toAccount = getOrCreateWTagAccount(event.params.to);

  let mintId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let mint = new WTagMint(mintId);
  mint.to = toAccount.id;
  mint.amount = event.params.amount;
  mint.totalSupplyAfter = event.params.totalSupply;
  mint.timestamp = event.block.timestamp;
  mint.blockNumber = event.block.number;
  mint.transactionHash = event.transaction.hash;
  mint.save();

  // Update protocol supply tracking
  let protocol = getOrCreateProtocol();
  protocol.wtagTotalSupply = event.params.totalSupply;
  protocol.save();
}

export function handleTokensBurned(event: TokensBurned): void {
  let fromAccount = getOrCreateWTagAccount(event.params.from);

  let burnId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let burn = new WTagBurn(burnId);
  burn.from = fromAccount.id;
  burn.amount = event.params.amount;
  burn.totalSupplyAfter = event.params.totalSupply;
  burn.timestamp = event.block.timestamp;
  burn.blockNumber = event.block.number;
  burn.transactionHash = event.transaction.hash;
  burn.save();

  // Update protocol supply and burn tracking
  let protocol = getOrCreateProtocol();
  protocol.wtagTotalSupply = event.params.totalSupply;
  protocol.wtagTotalBurned = protocol.wtagTotalBurned.plus(event.params.amount);
  protocol.save();
}

export function handleEmissionsAddressSet(event: EmissionsAddressSet): void {
  let configId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let config = new WTagEmissionsConfig(configId);
  config.emissions = event.params.emissions;
  config.setter = event.params.setter;
  config.timestamp = event.block.timestamp;
  config.blockNumber = event.block.number;
  config.transactionHash = event.transaction.hash;
  config.save();
}

export function handleContractUpgraded(event: ContractUpgraded): void {
  let upgradeId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let upgrade = new WTagUpgrade(upgradeId);
  upgrade.newImplementation = event.params.newImplementation;
  upgrade.version = event.params.version;
  upgrade.timestamp = event.block.timestamp;
  upgrade.blockNumber = event.block.number;
  upgrade.transactionHash = event.transaction.hash;
  upgrade.save();
}
