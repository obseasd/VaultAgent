import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface VerificationResult {
  passed: boolean;
  confidence: number;
  reason: string;
  details: string[];
}

export interface EscrowContext {
  amount: string;
  buyer: string;
  seller: string;
}

export async function verifyCondition(
  conditionDescription: string,
  proofData: string,
  escrowContext: EscrowContext
): Promise<VerificationResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are VaultAgent, an AI escrow condition verifier on SKALE blockchain.
Your job is to analyze delivery proofs and determine if escrow conditions are met.
Be strict but fair. Always explain your reasoning.
Return JSON only — no markdown, no code fences.`,
    messages: [
      {
        role: "user",
        content: `## Escrow Context
- Amount: ${escrowContext.amount} sFUEL
- Buyer: ${escrowContext.buyer}
- Seller: ${escrowContext.seller}

## Condition to Verify
${conditionDescription}

## Proof Submitted by Seller
${proofData}

## Task
Analyze the proof against the condition. Return JSON:
{
  "passed": true/false,
  "confidence": 0-100,
  "reason": "one-line explanation",
  "details": ["detail1", "detail2"]
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text) as VerificationResult;
  } catch {
    return {
      passed: false,
      confidence: 0,
      reason: "Failed to parse AI response",
      details: [text],
    };
  }
}
