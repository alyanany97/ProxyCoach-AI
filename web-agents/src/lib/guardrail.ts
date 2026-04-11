import { prisma } from "@/lib/prisma";

/**
 * ProxyCoach AI safety guardrail.
 *
 * Evaluates messages for harmful fitness/health content before passing them
 * to the AI agents. Flagged interactions are logged to the database for
 * review and auditing.
 */

const BLOCKLIST_TERMS: Array<{ term: string; pattern: RegExp }> = [
  // Dangerous weight loss / eating disorder territory
  { term: "starvation diet", pattern: /starvation diet/i },
  { term: "stop eating", pattern: /\bstop eating\b/i },
  { term: "don't eat", pattern: /don'?t eat/i },
  { term: "refuse to eat", pattern: /refuse to eat/i },
  { term: "extreme caloric restriction", pattern: /extreme caloric restriction/i },
  { term: "under 500 calories", pattern: /under 500 calories/i },
  { term: "purging", pattern: /\bpurging\b/i },
  { term: "laxative abuse", pattern: /laxative abuse/i },
  { term: "binge and purge", pattern: /binge and purge/i },
  { term: "anorexia", pattern: /\banorexia\b/i },
  { term: "bulimia", pattern: /\bbulimia\b/i },

  // Performance-enhancing drug abuse
  { term: "steroids", pattern: /\bsteroids\b/i },
  { term: "anabolic steroids", pattern: /anabolic steroids/i },
  { term: "testosterone injection", pattern: /testosterone injection/i },
  { term: "growth hormone", pattern: /growth hormone/i },
  { term: "EPO", pattern: /\bEPO\b/ },
  { term: "blood doping", pattern: /blood doping/i },
  { term: "SARM", pattern: /\bSARMs?\b/i },
  { term: "peptide abuse", pattern: /peptide abuse/i },

  // Self-harm / dangerous training
  { term: "train through injury", pattern: /train through (a )?(serious |severe )?injury/i },
  { term: "ignore pain", pattern: /ignore (the )?(pain|injury)/i },
  { term: "push through broken", pattern: /push through (a )?broken/i },
  { term: "self-harm", pattern: /self[-\s]harm/i },
  { term: "hurt myself", pattern: /hurt my(self)?/i },
  { term: "injure myself", pattern: /injure my(self)?/i },

  // Medical diagnosis / prescription overreach
  { term: "diagnose me", pattern: /diagnose me/i },
  { term: "prescribe me", pattern: /prescribe me/i },
  { term: "what medication", pattern: /what medication/i },
  { term: "what drug should I take", pattern: /what drug should (i|we) take/i },
  { term: "medical prescription", pattern: /medical prescription/i },

  // Violence / threats
  { term: "kill", pattern: /\bkill\b/i },
  { term: "suicide", pattern: /\bsuicide\b/i },
  { term: "end my life", pattern: /end my life/i },
  { term: "hurt someone", pattern: /hurt (someone|somebody|them|him|her)/i },
];

/**
 * Returns which blocklist terms matched the user message.
 */
export function findMatchedBlocklistTerms(userMessage: string): string[] {
  if (!userMessage) return [];
  return BLOCKLIST_TERMS
    .filter(({ pattern }) => pattern.test(userMessage))
    .map(({ term }) => term);
}

/**
 * Returns a user-friendly explanation based on the matched term category.
 */
export function generateBlockExplanation(matchedTerm: string): string {
  const t = matchedTerm.toLowerCase();

  if (
    t.includes("starvat") || t.includes("stop eating") || t.includes("don't eat") ||
    t.includes("caloric restriction") || t.includes("500 calorie") ||
    t.includes("purging") || t.includes("laxative") || t.includes("binge") ||
    t.includes("anorexia") || t.includes("bulimia")
  ) {
    return "This message touches on disordered eating patterns that could be harmful. Your safety is the top priority — please speak with a registered dietitian or healthcare professional for guidance on this topic.";
  }

  if (
    t.includes("steroid") || t.includes("testosterone injection") ||
    t.includes("growth hormone") || t.includes("epo") ||
    t.includes("blood doping") || t.includes("sarm") || t.includes("peptide")
  ) {
    return "Questions about performance-enhancing substances fall outside what ProxyCoach AI can advise on. Please consult a licensed medical professional or sports physician.";
  }

  if (
    t.includes("train through") || t.includes("ignore pain") ||
    t.includes("push through broken") || t.includes("self-harm") ||
    t.includes("hurt myself") || t.includes("injure myself")
  ) {
    return "Training through serious injury or pain can cause lasting harm. Please stop and consult a physiotherapist or physician before continuing.";
  }

  if (
    t.includes("diagnose") || t.includes("prescribe") ||
    t.includes("medication") || t.includes("drug should")
  ) {
    return "ProxyCoach AI cannot provide medical diagnoses or prescriptions. Please speak with a licensed healthcare provider for medical advice.";
  }

  if (
    t.includes("kill") || t.includes("suicide") ||
    t.includes("end my life") || t.includes("hurt someone")
  ) {
    return "It sounds like you may be going through something difficult. Please reach out to a crisis support line or mental health professional — you don't have to face this alone.";
  }

  return "This message contains content that ProxyCoach AI is not able to respond to. Please consult the appropriate professional for assistance.";
}

/**
 * Returns the guardrail block message to stream back to the user.
 */
export function generateGuardrailResponse(matchedTerm: string, existingResponse?: string): string {
  const explanation = generateBlockExplanation(matchedTerm);
  if (existingResponse && existingResponse.toLowerCase().includes(explanation.toLowerCase().substring(0, 50))) {
    return existingResponse;
  }
  return explanation;
}

/**
 * Logs a guardrail block to the console and saves an escalation incident to the database.
 */
export async function logGuardrailBlock(
  reason: string,
  details: {
    userId: string;
    companyId: string;
    agentId: string;
    conversationId?: string;
    userMessage?: string;
    responseContent?: string;
    finishReason?: string;
    errorDetails?: any;
    metadata?: any;
  }
) {
  const matchedTerms = details.userMessage ? findMatchedBlocklistTerms(details.userMessage) : [];

  console.error("=".repeat(80));
  console.error("🚫 PROXYCOACH GUARDRAIL BLOCK");
  console.error("=".repeat(80));
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    reason,
    user: { id: details.userId, companyId: details.companyId },
    agent: { id: details.agentId },
    userMessage: details.userMessage?.substring(0, 200),
    matchedTerm: matchedTerms[0],
    allMatchedTerms: matchedTerms.length > 1 ? matchedTerms : undefined,
    finishReason: details.finishReason,
  }, null, 2));
  console.error("=".repeat(80));

  if (details.userId && details.companyId) {
    try {
      await prisma.escalationIncident.create({
        data: {
          userId: details.userId,
          companyId: details.companyId,
          chatId: details.conversationId || null,
          question: details.userMessage || "No question provided",
        },
      });
      console.log("[ProxyCoach] ✅ Escalation incident saved");
    } catch (error) {
      console.error("[ProxyCoach] ❌ Failed to save escalation incident:", error);
    }
  }
}
