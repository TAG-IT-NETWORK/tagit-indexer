import { BigInt } from "@graphprotocol/graph-ts";
import {
  ValidationRequested,
  ValidationResponseSubmitted,
  ValidationFinalized,
} from "../../generated/TAGITAgentValidation/TAGITAgentValidation";
import {
  Agent,
  ValidationRequest,
  ValidationResponse,
} from "../../generated/schema";
import { getOrCreateProtocol } from "../helpers/protocol";
import { ZERO_BI } from "../helpers/constants";

export function handleValidationRequested(event: ValidationRequested): void {
  let requestId = event.params.requestId.toString();
  let request = new ValidationRequest(requestId);

  request.requestId = event.params.requestId;
  request.agent = event.params.agentId.toString();
  request.requester = event.params.requester;
  request.isDefense = event.params.isDefense;
  request.status = "PENDING";
  request.responseCount = 0;
  request.passed = false;
  request.finalScore = ZERO_BI;
  request.createdAt = event.block.timestamp;
  request.createdAtBlock = event.block.number;
  request.finalizedAt = null;
  request.save();

  // Update Agent aggregate
  let agent = Agent.load(event.params.agentId.toString());
  if (agent != null) {
    agent.validationRequestCount += 1;
    agent.save();
  }

  // Update Protocol aggregate
  let protocol = getOrCreateProtocol();
  protocol.totalValidationRequests += 1;
  protocol.save();
}

export function handleValidationResponseSubmitted(
  event: ValidationResponseSubmitted
): void {
  let responseId =
    event.params.requestId.toString() +
    "-" +
    event.params.validator.toHexString();
  let response = new ValidationResponse(responseId);

  response.request = event.params.requestId.toString();
  response.validator = event.params.validator;
  response.score = event.params.score;
  response.submittedAt = event.block.timestamp;
  response.submittedAtBlock = event.block.number;
  response.transactionHash = event.transaction.hash;
  response.save();

  // Update ValidationRequest
  let request = ValidationRequest.load(event.params.requestId.toString());
  if (request != null) {
    request.responseCount += 1;
    request.status = "IN_PROGRESS";
    request.save();
  }
}

export function handleValidationFinalized(event: ValidationFinalized): void {
  let request = ValidationRequest.load(event.params.requestId.toString());
  if (request == null) return;

  request.passed = event.params.passed;
  request.finalScore = event.params.finalScore;
  request.status = event.params.passed ? "VALIDATED" : "REJECTED";
  request.finalizedAt = event.block.timestamp;
  request.save();

  // Update Agent aggregates
  let agent = Agent.load(event.params.agentId.toString());
  if (agent != null) {
    if (event.params.passed) {
      agent.validationPassedCount += 1;
      agent.isValidated = true;
    } else {
      agent.validationFailedCount += 1;
    }
    agent.save();
  }

  // Update Protocol aggregates
  let protocol = getOrCreateProtocol();
  if (event.params.passed) {
    protocol.totalValidationsPassed += 1;
  } else {
    protocol.totalValidationsFailed += 1;
  }
  protocol.save();
}
