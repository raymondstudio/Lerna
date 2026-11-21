import { NextResponse } from "next/server";
import { AuthApiError } from "@/lib/auth/require-active-user-api";
import { OperationError } from "@/lib/repositories/operations";
import { MaterialBoundaryError } from "./validation";

export function materialErrorResponse(error: unknown, requestId: string) {
  if (error instanceof OperationError) return NextResponse.json({ success: false, requestId, error: {
    code: error.status === 429 ? "QUOTA_EXCEEDED" : "OPERATION_UNAVAILABLE", message: error.message,
  } }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  const known = error instanceof AuthApiError || error instanceof MaterialBoundaryError;
  return NextResponse.json({ success: false, requestId, error: {
    code: known ? error.code : "DEPENDENCY_UNAVAILABLE",
    message: known ? error.message : "This operation is temporarily unavailable. Please retry.",
  } }, { status: known ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
}
