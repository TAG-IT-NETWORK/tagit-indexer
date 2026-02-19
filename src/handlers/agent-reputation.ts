import {
  FeedbackGiven,
  FeedbackRevoked,
  ResponseAppended,
} from "../../generated/TAGITAgentReputation/TAGITAgentReputation";
import { Agent, Feedback } from "../../generated/schema";
import { getOrCreateProtocol } from "../helpers/protocol";
import { computeAverage } from "../helpers/math";

export function handleFeedbackGiven(event: FeedbackGiven): void {
  let feedbackId = event.params.feedbackId.toString();
  let feedback = new Feedback(feedbackId);

  feedback.feedbackId = event.params.feedbackId;
  feedback.agent = event.params.agentId.toString();
  feedback.reviewer = event.params.reviewer;
  feedback.rating = event.params.rating;
  feedback.revoked = false;
  feedback.hasResponse = false;
  feedback.createdAt = event.block.timestamp;
  feedback.createdAtBlock = event.block.number;
  feedback.save();

  // Update Agent aggregates
  let agent = Agent.load(event.params.agentId.toString());
  if (agent != null) {
    agent.feedbackCount += 1;
    agent.activeFeedbackCount += 1;
    agent.ratingSum += event.params.rating;
    agent.averageRating = computeAverage(agent.ratingSum, agent.activeFeedbackCount);
    agent.save();
  }

  // Update Protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalFeedback += 1;
  protocol.totalActiveFeedback += 1;
  protocol.totalRatingSum += event.params.rating;
  protocol.averageRating = computeAverage(
    protocol.totalRatingSum,
    protocol.totalActiveFeedback
  );
  protocol.save();
}

export function handleFeedbackRevoked(event: FeedbackRevoked): void {
  let feedback = Feedback.load(event.params.feedbackId.toString());
  if (feedback == null) return;
  if (feedback.revoked) return;

  let rating = feedback.rating;

  feedback.revoked = true;
  feedback.save();

  // Update Agent aggregates
  let agent = Agent.load(event.params.agentId.toString());
  if (agent != null) {
    agent.activeFeedbackCount -= 1;
    agent.ratingSum -= rating;
    agent.averageRating = computeAverage(agent.ratingSum, agent.activeFeedbackCount);
    agent.save();
  }

  // Update Protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalActiveFeedback -= 1;
  protocol.totalRatingSum -= rating;
  protocol.averageRating = computeAverage(
    protocol.totalRatingSum,
    protocol.totalActiveFeedback
  );
  protocol.save();
}

export function handleResponseAppended(event: ResponseAppended): void {
  let feedback = Feedback.load(event.params.feedbackId.toString());
  if (feedback == null) return;

  feedback.hasResponse = true;
  feedback.save();
}
