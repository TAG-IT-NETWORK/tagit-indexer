import { CoreProtocol } from "../../generated/schema";

const CORE_PROTOCOL_ID = "1";

export function getOrCreateCoreProtocol(): CoreProtocol {
  let protocol = CoreProtocol.load(CORE_PROTOCOL_ID);
  if (protocol == null) {
    protocol = new CoreProtocol(CORE_PROTOCOL_ID);
    protocol.totalAssets = 0;
    protocol.stateMinted = 0;
    protocol.stateBound = 0;
    protocol.stateActivated = 0;
    protocol.stateClaimed = 0;
    protocol.stateFlagged = 0;
    protocol.stateRecycled = 0;
    protocol.totalTransfers = 0;
  }
  return protocol;
}
