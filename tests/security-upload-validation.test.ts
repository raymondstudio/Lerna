import { describe, expect, it } from "vitest";
import { assertOwnedStoragePath, readBoundedBody, validateUploadBuffer, validateUploadMetadata } from "@/lib/uploads/validation";
import { UPLOAD_LIMITS } from "@/lib/uploads/limits";
const a = "11111111-1111-4111-8111-111111111111";
const session = "22222222-2222-4222-8222-222222222222";
describe("bounded upload boundary", () => {
  it("accepts a supported genuine text upload", () => {
    const data = Buffer.from("Synthetic learning fixture");
    expect(validateUploadMetadata("lesson.txt", "text/plain", data.length).mimeType).toBe("text/plain");
    expect(() => validateUploadBuffer(data, "text/plain")).not.toThrow();
  });
  it("rejects spoofed signatures, malformed text and invalid metadata", () => {
    expect(() => validateUploadBuffer(Buffer.from("not a PDF"), "application/pdf")).toThrow(/match/);
    expect(() => validateUploadBuffer(Buffer.from([0xff, 0xfe]), "text/plain")).toThrow();
    expect(() => validateUploadBuffer(Buffer.from("<html>fixture</html>"), "text/plain")).toThrow();
    expect(() => validateUploadMetadata("../lesson.txt", "text/plain", 20)).toThrow();
    expect(() => validateUploadMetadata("lesson.exe", "text/plain", 20)).toThrow();
    expect(() => validateUploadMetadata("lesson.pdf", "text/plain", 20)).toThrow();
    expect(() => validateUploadMetadata("lesson.txt", "text/plain", UPLOAD_LIMITS.fileBytes + 1)).toThrow();
  });
  it("binds paths to the verified user and owned session", () => {
    expect(assertOwnedStoragePath(`${a}/${session}/fixture.txt`, a, session)).toContain("fixture.txt");
    for (const path of [`foreign/${session}/fixture.txt`, `${a}/foreign/fixture.txt`, `${a}/${session}/../fixture.txt`, `${a}/${session}/%2fsecret`]) {
      expect(() => assertOwnedStoragePath(path, a, session)).toThrow();
    }
  });
  it("bounds stalled streams by a total deadline and accepts a fast stream", async () => {
    let cancelled = false;
    const stalled = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel() { cancelled = true; } });
    const request = { headers: new Headers(), body: stalled, signal: new AbortController().signal };
    await expect(readBoundedBody(request, 100, 20)).rejects.toMatchObject({ status: 408, code: "BODY_TIMEOUT" });
    expect(cancelled).toBe(true);
    await expect(readBoundedBody(new Request("http://localhost/fixture", { method: "POST", body: "fast" }), 100, 100)).resolves.toHaveLength(4);
  });
  it("enforces actual streamed bytes even without Content-Length", async () => {
    const request = new Request("http://localhost/fixture", { method: "POST", body: "elevenbytes" });
    await expect(readBoundedBody(request, 5)).rejects.toMatchObject({ status: 413 });
    await expect(readBoundedBody(new Request("http://localhost/fixture", { method: "POST", body: "small" }), 5)).resolves.toHaveLength(5);
  });
});
