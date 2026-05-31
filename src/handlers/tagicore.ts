import { BigInt } from "@graphprotocol/graph-ts";
import {
  AssetMinted,
  StateChanged,
  TagBound,
  CustodyTransfer,
  ResolveApproved,
} from "../../generated/TAGITCore/TAGITCore";
import {
  Asset,
  CoreProtocol,
  StateTransition,
  CustodyChange,
  ResolveApproval,
} from "../../generated/schema";
import { lifecycleStateLabel } from "../helpers/lifecycle";
import { getOrCreateCoreProtocol } from "../helpers/core-protocol";

/**
 * Handle AssetMinted(uint256 indexed tokenId, address indexed to, bytes32 metadata)
 * Creates a new Asset entity in MINTED state.
 */
export function handleAssetMinted(event: AssetMinted): void {
  let tokenId = event.params.tokenId.toString();
  let asset = new Asset(tokenId);

  asset.tokenId = event.params.tokenId;
  asset.owner = event.params.to;
  asset.metadata = event.params.metadata;
  asset.state = 1; // MINTED
  asset.stateLabel = lifecycleStateLabel(1);
  asset.tagHash = null;
  asset.mintedAt = event.block.timestamp;
  asset.mintedAtBlock = event.block.number;
  asset.lastStateChangeAt = event.block.timestamp;
  asset.transactionHash = event.transaction.hash;
  asset.save();

  let protocol = getOrCreateCoreProtocol();
  protocol.totalAssets += 1;
  protocol.stateMinted += 1;
  protocol.save();
}

/**
 * Handle StateChanged(uint256 indexed tokenId, State from, State to, address actor)
 * Updates Asset state and creates immutable StateTransition record.
 */
export function handleStateChanged(event: StateChanged): void {
  let asset = Asset.load(event.params.tokenId.toString());
  if (asset == null) return;

  let fromState = event.params.from;
  let toState = event.params.to;

  // Update Asset entity
  asset.state = toState;
  asset.stateLabel = lifecycleStateLabel(toState);
  asset.lastStateChangeAt = event.block.timestamp;
  asset.save();

  // Create immutable StateTransition
  let transitionId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transition = new StateTransition(transitionId);
  transition.asset = asset.id;
  transition.fromState = fromState;
  transition.toState = toState;
  transition.fromStateLabel = lifecycleStateLabel(fromState);
  transition.toStateLabel = lifecycleStateLabel(toState);
  transition.actor = event.params.actor;
  transition.timestamp = event.block.timestamp;
  transition.blockNumber = event.block.number;
  transition.transactionHash = event.transaction.hash;
  transition.save();

  // Update protocol counters (decrement old, increment new)
  let protocol = getOrCreateCoreProtocol();
  _decrementState(protocol, fromState);
  _incrementState(protocol, toState);
  protocol.save();
}

/**
 * Handle TagBound(uint256 indexed tokenId, bytes32 indexed tagHash)
 * Sets the NFC tag hash on the Asset entity.
 */
export function handleTagBound(event: TagBound): void {
  let asset = Asset.load(event.params.tokenId.toString());
  if (asset == null) return;

  asset.tagHash = event.params.tagHash;
  asset.save();
}

/**
 * Handle CustodyTransfer(uint256 indexed assetId, uint8 fromState, uint8 toState,
 *   address indexed fromOwner, address indexed toOwner, uint256 timestamp, bytes32 prevStateHash)
 * Updates Asset owner and creates immutable CustodyChange audit record.
 */
export function handleCustodyTransfer(event: CustodyTransfer): void {
  let asset = Asset.load(event.params.assetId.toString());
  if (asset == null) return;

  // Update current owner
  asset.owner = event.params.toOwner;
  asset.save();

  // Create immutable CustodyChange
  let changeId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let change = new CustodyChange(changeId);
  change.asset = asset.id;
  change.fromState = event.params.fromState;
  change.toState = event.params.toState;
  change.fromOwner = event.params.fromOwner;
  change.toOwner = event.params.toOwner;
  change.timestamp = event.params.timestamp;
  change.prevStateHash = event.params.prevStateHash;
  change.blockNumber = event.block.number;
  change.transactionHash = event.transaction.hash;
  change.save();

  let protocol = getOrCreateCoreProtocol();
  protocol.totalTransfers += 1;
  protocol.save();
}

/**
 * Handle ResolveApproved(uint256 indexed tokenId, address indexed approver, uint256 approvalCount)
 * Creates immutable ResolveApproval record.
 */
export function handleResolveApproved(event: ResolveApproved): void {
  let asset = Asset.load(event.params.tokenId.toString());
  if (asset == null) return;

  let approvalId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let approval = new ResolveApproval(approvalId);
  approval.asset = asset.id;
  approval.approver = event.params.approver;
  approval.approvalCount = event.params.approvalCount.toI32();
  approval.timestamp = event.block.timestamp;
  approval.blockNumber = event.block.number;
  approval.transactionHash = event.transaction.hash;
  approval.save();
}

// ============================================================
// HELPERS — Protocol state counters
// ============================================================

function _decrementState(protocol: CoreProtocol, state: i32): void {
  if (state == 1 && protocol.stateMinted > 0) protocol.stateMinted -= 1;
  else if (state == 2 && protocol.stateBound > 0) protocol.stateBound -= 1;
  else if (state == 3 && protocol.stateActivated > 0) protocol.stateActivated -= 1;
  else if (state == 4 && protocol.stateClaimed > 0) protocol.stateClaimed -= 1;
  else if (state == 5 && protocol.stateFlagged > 0) protocol.stateFlagged -= 1;
  else if (state == 6 && protocol.stateRecycled > 0) protocol.stateRecycled -= 1;
}

function _incrementState(protocol: CoreProtocol, state: i32): void {
  if (state == 1) protocol.stateMinted += 1;
  else if (state == 2) protocol.stateBound += 1;
  else if (state == 3) protocol.stateActivated += 1;
  else if (state == 4) protocol.stateClaimed += 1;
  else if (state == 5) protocol.stateFlagged += 1;
  else if (state == 6) protocol.stateRecycled += 1;
}
