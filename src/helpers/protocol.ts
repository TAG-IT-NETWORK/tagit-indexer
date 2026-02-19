import { Protocol } from "../../generated/schema";
import { PROTOCOL_ID, ZERO_BD } from "./constants";

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID);
  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_ID);
    protocol.totalAgents = 0;
    protocol.totalActiveAgents = 0;
    protocol.totalFeedback = 0;
    protocol.totalActiveFeedback = 0;
    protocol.totalRatingSum = 0;
    protocol.averageRating = ZERO_BD;
    protocol.totalValidationRequests = 0;
    protocol.totalValidationsPassed = 0;
    protocol.totalValidationsFailed = 0;
  }
  return protocol;
}
