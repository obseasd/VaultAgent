import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { escrowId, condition, proof, context } = body;

    if (!condition || !proof) {
      return NextResponse.json(
        { error: "Missing condition or proof" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are VaultAgent, an AI escrow condition verifier on SKALE blockchain.
Your job is to analyze delivery proofs and determine if escrow conditions are met.
Be strict but fair. Always explain your reasoning.
Return JSON only — no markdown, no code fences, no extra text.`,
      messages: [
        {
          role: "user",
          content: `## Escrow Context
- Escrow ID: ${escrowId}
- Amount: ${context?.amount || "unknown"} sFUEL
- Buyer: ${context?.buyer || "unknown"}
- Seller: ${context?.seller || "unknown"}

## Condition to Verify
${condition}

## Proof Submitted by Seller
${proof}

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

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        passed: false,
        confidence: 0,
        reason: "Failed to parse AI response",
        details: [text],
      };
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      escrowId,
    });
  } catch (error: any) {
    console.error("Verify condition API error:", error);
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 500 }
    );
  }
}
