import { Agent } from "@/components/agents/AgentList";

/**
 * ProxyCoach AI — three specialized RAG agents.
 * Each agent is grounded in trainer-specific knowledge via Azure AI Search.
 *
 * Agent IDs must match the Foundry deployment identifiers configured in
 * TRAINING_COACH_ENDPOINT / NUTRITION_ADVISOR_ENDPOINT / RECOVERY_TRACKER_ENDPOINT
 * environment variables (or fall back to RESPONSES_API_ENDPOINT).
 */
export const AGENTS: Agent[] = [
  {
    id: "training-coach",
    name: "Training Coach",
    description:
      "Workout programming, exercise guidance, and progression planning grounded in your trainer's methodology.",
  },
  {
    id: "nutrition-advisor",
    name: "Nutrition Advisor",
    description:
      "Dietary recommendations and meal guidance aligned with your trainer's nutritional approach and your personal goals.",
  },
  {
    id: "recovery-tracker",
    name: "Recovery Tracker",
    description:
      "Injury prevention, recovery planning, and load management to keep you performing at your best.",
  },
];
