import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ZERO_BD } from "./constants";

export function computeAverage(sum: i32, count: i32): BigDecimal {
  if (count == 0) return ZERO_BD;
  return BigDecimal.fromString(sum.toString()).div(
    BigDecimal.fromString(count.toString())
  );
}
