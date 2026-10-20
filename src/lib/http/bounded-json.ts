import { readBoundedBody, MaterialBoundaryError } from "@/lib/uploads/validation";
import { OperationError } from "@/lib/repositories/operations";
export async function readBoundedJson(request: Request, limit = 512_000): Promise<unknown> {
  try { return JSON.parse((await readBoundedBody(request, limit)).toString("utf8")); }
  catch (error) {
    if (error instanceof MaterialBoundaryError) throw new OperationError(error.message, error.status);
    throw new OperationError("The request must contain valid JSON.", 400);
  }
}
