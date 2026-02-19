import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const PROTOCOL_ID = "1";

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");

export function statusToLabel(status: i32): string {
  if (status == 0) return "INACTIVE";
  if (status == 1) return "ACTIVE";
  if (status == 2) return "SUSPENDED";
  if (status == 3) return "DEREGISTERED";
  return "UNKNOWN";
}
