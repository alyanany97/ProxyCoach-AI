import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";

/**
 * Blocklist terms from legal-leo-blocklist.csv
 * Loaded once at module initialization
 */
let blocklistTerms: Array<{ term: string; pattern: RegExp }> = [];

function loadBlocklist() {
  if (blocklistTerms.length > 0) return; // Already loaded
  
  try {
    // Try to read from the root directory (where the CSV file is)
    // From web-agents directory, go up to pmai-agent-app, then to root
    const blocklistPath = join(process.cwd(), '..', '..', 'legal-leo-blocklist.csv');
    const csvContent = readFileSync(blocklistPath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    blocklistTerms = lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const [term] = line.split(','); // Get term before comma
        const trimmedTerm = term.trim();
        if (trimmedTerm) {
          return {
            term: trimmedTerm,
            pattern: new RegExp(trimmedTerm, 'i') // Case-insensitive regex
          };
        }
        return null;
      })
      .filter((item): item is { term: string; pattern: RegExp } => item !== null);
  } catch (error) {
    // Fallback: hardcoded blocklist if file can't be read
    console.warn('[Legal Leo] Could not load blocklist file, using fallback:', error);
    blocklistTerms = [
      { term: '(fair housing|protected class)', pattern: /(fair housing|protected class)/i },
      { term: 'discriminat(e|ion|ing|ory)', pattern: /discriminat(e|ion|ing|ory)/i },
      { term: '(refuse|won\'t|will not) (rent|lease) to', pattern: /(refuse|won't|will not) (rent|lease) to/i },
      { term: '(only|prefer|want) (rent|lease) to', pattern: /(only|prefer|want) (rent|lease) to/i },
      { term: 'no (children|kids|families)', pattern: /no (children|kids|families)/i },
      { term: '(adult|professional|quiet) (only|tenants|residents)', pattern: /(adult|professional|quiet) (only|tenants|residents)/i },
      { term: 'familial status', pattern: /familial status/i },
      { term: 'domestic (violence|abuse)', pattern: /domestic (violence|abuse)/i },
      { term: 'abusive (partner|spouse|landlord|tenant)', pattern: /abusive (partner|spouse|landlord|tenant)/i },
      { term: '(restraining|protective) order', pattern: /(restraining|protective) order/i },
      { term: '(threat|threaten)(s|ed|ing)?', pattern: /(threat|threaten)(s|ed|ing)?/i },
      { term: 'tenant safety', pattern: /tenant safety/i },
      { term: 'sexual (assault|harassment)', pattern: /sexual (assault|harassment)/i },
      { term: 'inappropriate touch(ing)?', pattern: /inappropriate touch(ing)?/i },
      { term: 'unwanted advance(s)?', pattern: /unwanted advance(s)?/i },
      { term: '(sexual|inappropriate) (behavior|conduct)', pattern: /(sexual|inappropriate) (behavior|conduct)/i },
      { term: 'ADA', pattern: /ADA/i },
      { term: 'americans with disabilities', pattern: /americans with disabilities/i },
      { term: 'disability (accommodation|modification|access)', pattern: /disability (accommodation|modification|access)/i },
      { term: 'service animal', pattern: /service animal/i },
      { term: 'emotional support animal', pattern: /emotional support animal/i },
      { term: 'wheelchair (access|ramp|accessible)', pattern: /wheelchair (access|ramp|accessible)/i },
      { term: 'reasonable accommodation', pattern: /reasonable accommodation/i },
      { term: 'accessib(le|ility)', pattern: /accessib(le|ility)/i },
      { term: 'evict(ion|ions|ing|ed)?', pattern: /evict(ion|ions|ing|ed)?/i },
      { term: 'unlawful detainer', pattern: /unlawful detainer/i },
      { term: '\\d+-day notice', pattern: /\d+-day notice/i },
      { term: '(notice to|notice of) (quit|vacate|terminate)', pattern: /(notice to|notice of) (quit|vacate|terminate)/i },
      { term: 'court filing', pattern: /court filing/i },
      { term: '(forcibly|force|physically) remove', pattern: /(forcibly|force|physically) remove/i },
      { term: 'sheriff (eviction|removal)', pattern: /sheriff (eviction|removal)/i },
      { term: '(conflict|contradict)(ing|ory|ion)?', pattern: /(conflict|contradict)(ing|ory|ion)?/i },
      { term: 'inconsistent (lease|rule|term|clause|policy)', pattern: /inconsistent (lease|rule|term|clause|policy)/i },
      { term: 'lease (conflict|contradiction)', pattern: /lease (conflict|contradiction)/i },
      { term: 'contradictory (lease|rule|agreement)', pattern: /contradictory (lease|rule|agreement)/i },
    ];
  }
}

/**
 * Find which blocklist term(s) matched the user message
 * Uses the CSV file blocklist to match against the user message
 */
export function findMatchedBlocklistTerms(userMessage: string): string[] {
  if (!userMessage) return [];
  
  loadBlocklist(); // Ensure blocklist is loaded
  
  const matchedTerms: string[] = [];
  
  for (const { term, pattern } of blocklistTerms) {
    if (pattern.test(userMessage)) {
      matchedTerms.push(term);
    }
  }
  
  return matchedTerms;
}

/**
 * Generate a user-friendly explanation based on the matched blocklist term
 */
export function generateBlockExplanation(matchedTerm: string): string {
  const termLower = matchedTerm.toLowerCase();
  
  // Eviction-related terms
  if (termLower.includes('evict') || termLower.includes('unlawful detainer') || 
      termLower.includes('notice') || termLower.includes('remove') || 
      termLower.includes('sheriff')) {
    return " This request involves eviction procedures, which require specific legal guidance that I cannot provide through this platform. Please consult with a qualified attorney for assistance with eviction matters.";
  }
  
  // Discrimination-related terms
  if (termLower.includes('discriminat') || termLower.includes('fair housing') || 
      termLower.includes('protected class') || termLower.includes('familial status') ||
      termLower.includes('refuse') || termLower.includes('only') || 
      termLower.includes('prefer') || termLower.includes('no children') ||
      termLower.includes('adult only')) {
    return " This request involves fair housing and anti-discrimination laws. Providing guidance on these sensitive topics requires careful legal analysis that should be handled by a qualified attorney familiar with your specific jurisdiction and circumstances.";
  }
  
  // Safety/violence-related terms
  if (termLower.includes('domestic') || termLower.includes('abuse') || 
      termLower.includes('violence') || termLower.includes('threat') ||
      termLower.includes('restraining') || termLower.includes('protective') ||
      termLower.includes('sexual') || termLower.includes('assault') ||
      termLower.includes('harassment') || termLower.includes('inappropriate') ||
      termLower.includes('unwanted')) {
    return " This request involves matters of safety, violence, or harassment. These are serious legal issues that require immediate attention from qualified legal professionals and potentially law enforcement. I cannot provide guidance on these matters through this platform.";
  }
  
  // ADA/disability-related terms
  if (termLower.includes('ada') || termLower.includes('disability') || 
      termLower.includes('accommodation') || termLower.includes('service animal') ||
      termLower.includes('emotional support') || termLower.includes('wheelchair') ||
      termLower.includes('accessible')) {
    return " This request involves disability accommodations and accessibility requirements under the Americans with Disabilities Act (ADA) and Fair Housing Act. These matters require careful legal analysis based on specific circumstances and applicable laws.";
  }
  
  // Lease conflict terms
  if (termLower.includes('conflict') || termLower.includes('contradict') || 
      termLower.includes('inconsistent')) {
    return " This request involves conflicting or contradictory lease terms. Resolving these issues requires careful review of the specific lease language and applicable state and local laws, which should be handled by a qualified attorney.";
  }
  
  // Default explanation
  return " This request involves content that falls under our content filtering guidelines. For assistance with this matter, please consult with a qualified attorney who can provide guidance based on your specific circumstances and applicable laws.";
}

/**
 * Generate the guardrail block response message
 * Returns the specialized explanation for guardrail blocks
 */
export function generateGuardrailResponse(matchedTerm: string, existingResponse?: string): string {
  const explanation = generateBlockExplanation(matchedTerm);
  
  // If existing response already contains the explanation, return it as-is
  if (existingResponse && existingResponse.toLowerCase().includes(explanation.toLowerCase().substring(0, 50))) {
    return existingResponse;
  }
  
  // Return the specialized explanation
  return explanation;
}

/**
 * Log guardrail block with comprehensive details and save to database
 */
export async function logGuardrailBlock(
  reason: string,
  details: {
    userId: string;
    companyId: string;
    agentId: string;
    conversationId?: string; // Optional conversation/chat ID
    userMessage?: string;
    responseContent?: string;
    finishReason?: string;
    errorDetails?: any;
    metadata?: any;
  }
) {
  const timestamp = new Date().toISOString();
  
  // Find which specific blocklist term(s) matched from CSV file
  const matchedTerms = details.userMessage ? findMatchedBlocklistTerms(details.userMessage) : [];
  
  // Simplified log entry with only essential information
  const logEntry = {
    timestamp,
    reason,
    user: {
      id: details.userId,
      companyId: details.companyId,
    },
    agent: {
      id: details.agentId,
    },
    userMessage: details.userMessage ? details.userMessage.substring(0, 200) : undefined,
    matchedBlocklistTerm: matchedTerms.length > 0 ? matchedTerms[0] : undefined,
    allMatchedTerms: matchedTerms.length > 1 ? matchedTerms : undefined,
    finishReason: details.finishReason,
  };

  // Log with clear formatting for easy identification
  console.error('='.repeat(80));
  console.error('🚫 GUARDRAIL BLOCK DETECTED');
  console.error('='.repeat(80));
  console.error(JSON.stringify(logEntry, null, 2));
  console.error('='.repeat(80));
  
  // Save to escalation incidents database
  // Only save if we have required fields (userId and companyId)
  if (details.userId && details.companyId) {
    try {
      await prisma.escalationIncident.create({
        data: {
          userId: details.userId,
          companyId: details.companyId,
          chatId: details.conversationId || null,
          question: details.userMessage || 'No question provided',
        },
      });
      console.log('[Legal Leo] ✅ Escalation incident saved to database');
    } catch (error) {
      // Log error but don't throw - we don't want to break the guardrail flow
      console.error('[Legal Leo] ❌ Failed to save escalation incident to database:', error);
    }
  } else {
    console.warn('[Legal Leo] ⚠️ Skipping escalation incident save - missing userId or companyId');
  }
}
