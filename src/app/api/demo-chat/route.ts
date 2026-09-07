import { NextResponse } from "next/server";
import { generateText } from "@/lib/gemini/client";

export const dynamic = "force-dynamic";

// In-memory rate limiting state
const ipCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // max 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Prevent memory leaks: prune expired entries when cache grows large
  if (ipCache.size > 1000) {
    for (const [key, val] of ipCache.entries()) {
      if (now > val.resetTime) {
        ipCache.delete(key);
      }
    }
  }

  const record = ipCache.get(ip);

  if (!record) {
    ipCache.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return false;
  }

  record.count += 1;
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip")?.trim() || 
               "127.0.0.1";

    if (checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body: unknown = await req.json();
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

    const result = await generateText(demoScopingPrompt);
    const text = result?.text?.trim() || "I'm sorry, I couldn't generate an answer right now.";

    return NextResponse.json({
      success: true,
      reply: text,
    });

  } catch (error) {
    console.error("[demo-chat:api] error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to contact the tutoring service." },
      { status: 500 }
    );
  }
}
