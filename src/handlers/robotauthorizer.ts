import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  RobotActionAuthorized,
  ObjectSafetyClassUpdated,
  ObjectZoneUpdated,
  ObjectProhibitedActionsUpdated,
} from "../../generated/RoboticAuthorizer/RoboticAuthorizer";
import {
  RobotAuthorization,
  ObjectSecurityConfig,
} from "../../generated/schema";

/**
 * Handle RobotActionAuthorized(address indexed robot, uint256 indexed tokenId, uint256 actions, bytes32 zone, uint256 safetyClass)
 * Creates an immutable RobotAuthorization record.
 */
export function handleRobotActionAuthorized(
  event: RobotActionAuthorized
): void {
  let authId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let auth = new RobotAuthorization(authId);

  auth.robot = event.params.robot;
  auth.tokenId = event.params.tokenId;
  auth.actions = event.params.actions;
  auth.zone = event.params.zone;
  auth.safetyClass = event.params.safetyClass.toI32();
  auth.blockNumber = event.block.number;
  auth.blockTimestamp = event.block.timestamp;
  auth.transactionHash = event.transaction.hash;
  auth.save();
}

/**
 * Handle ObjectSafetyClassUpdated(uint256 indexed tokenId, SafetyClass previousClass, SafetyClass newClass)
 * Upserts the ObjectSecurityConfig entity for this token.
 */
export function handleObjectSafetyClassUpdated(
  event: ObjectSafetyClassUpdated
): void {
  let config = _getOrCreateSecurityConfig(event.params.tokenId);
  config.safetyClass = event.params.newClass;
  config.lastUpdated = event.block.timestamp;
  config.save();
}

/**
 * Handle ObjectZoneUpdated(uint256 indexed tokenId, bytes32 previousZone, bytes32 newZone)
 * Upserts the ObjectSecurityConfig entity for this token.
 */
export function handleObjectZoneUpdated(event: ObjectZoneUpdated): void {
  let config = _getOrCreateSecurityConfig(event.params.tokenId);
  config.zone = event.params.newZone;
  config.lastUpdated = event.block.timestamp;
  config.save();
}

/**
 * Handle ObjectProhibitedActionsUpdated(uint256 indexed tokenId, uint256 previousActions, uint256 newActions)
 * Upserts the ObjectSecurityConfig entity for this token.
 */
export function handleObjectProhibitedActionsUpdated(
  event: ObjectProhibitedActionsUpdated
): void {
  let config = _getOrCreateSecurityConfig(event.params.tokenId);
  config.prohibitedActions = event.params.newActions;
  config.lastUpdated = event.block.timestamp;
  config.save();
}

// ============================================================
// HELPERS — ObjectSecurityConfig upsert
// ============================================================

function _getOrCreateSecurityConfig(tokenId: BigInt): ObjectSecurityConfig {
  let id = tokenId.toString();
  let config = ObjectSecurityConfig.load(id);
  if (config == null) {
    config = new ObjectSecurityConfig(id);
    config.safetyClass = 0;
    config.zone = Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    config.prohibitedActions = BigInt.fromI32(0);
    config.lastUpdated = BigInt.fromI32(0);
  }
  return config;
}
