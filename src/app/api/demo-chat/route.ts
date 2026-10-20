import { NextResponse } from "next/server";
import { generateText } from "@/lib/gemini/client";
import { withDemoOperation, OperationError } from "@/lib/repositories/operations";
import { readBoundedJson } from "@/lib/http/bounded-json";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body: unknown = await readBoundedJson(req, 8_000);
    const typedBody = body as { message?: string } | null;
    const message = typeof typedBody?.message === "string" 
      ? (typedBody.message as string).trim() 
      : "";

    if (!message) {
      return NextResponse.json(
        { success: false, error: "A query is required." },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: "Query exceeds the maximum character limit." },
        { status: 400 }
      );
    }

    // Call Gemini directly with a lightweight scoping prompt to guide the response
    const demoScopingPrompt = `You are Lerna AI, an expert tutor. Provide a brief, engaging, and structured explanation of the student's question.
Keep the explanation under 3 sentences if possible, clear and structured. Use one analogy or example if helpful.

Student Question: "${message}"`;

    const result = await withDemoOperation(() => generateText(demoScopingPrompt, {requestType:"demo"}));
    const text = result?.text?.trim() || "I'm sorry, I couldn't generate an answer right now.";

    return NextResponse.json({
      success: true,
      reply: text,
    });

  } catch (error) {
    if (error instanceof OperationError) return NextResponse.json({success:false,error:error.message},{status:error.status});
    return NextResponse.json(
      { success: false, error: "Unable to contact the tutoring service." },
      { status: 500 }
    );
  }
}
