import { Worker } from "node:worker_threads";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { UPLOAD_LIMITS } from "@/lib/uploads/limits";

function zip(files: Array<{ name: string; text: string; declared?: number }>) {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name), raw = Buffer.from(file.text), compressed = deflateRawSync(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(file.declared ?? raw.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(file.declared ?? raw.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, name); offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
async function parse(buffer: Buffer, mimeType: string, limits: Partial<{ [Key in keyof typeof UPLOAD_LIMITS]: number }> = {}) {
  const worker = new Worker(path.join(process.cwd(), "src/lib/materials/parser-worker.cjs"), {
    workerData: { root: process.cwd(), buffer, mimeType, limits: { ...UPLOAD_LIMITS, ...limits } },
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  try {
    return await new Promise<{ ok: boolean; result?: unknown }>((resolve, reject) => {
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Fixture parser deadline")); }, 10_000);
      worker.once("message", (value) => { clearTimeout(timer); resolve(value); });
      worker.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
  } finally { await worker.terminate(); }
}
const pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const types = { name: "[Content_Types].xml", text: "<Types/>" };
describe("real isolated parser with small fixtures", () => {
  it("extracts actual text through the worker", async () => {
    expect(await parse(Buffer.from("Synthetic lesson"), "text/plain")).toMatchObject({ ok: true, result: [{ text: "Synthetic lesson" }] });
  });
  it("extracts a bounded PPTX slide from a small valid container", async () => {
    expect(await parse(zip([types, { name: "ppt/slides/slide1.xml", text: "<p:sld><a:t>Fixture slide</a:t></p:sld>" }]), pptx)).toMatchObject({ ok: true, result: [{ text: "Fixture slide", slide: 1 }] });
  });
  it("measures actual inflated bytes rather than trusting declared sizes", async () => {
    const fixture = zip([types, { name: "ppt/slides/slide1.xml", text: "x".repeat(100), declared: 1 }]);
    expect(await parse(fixture, pptx, { zipEntryBytes: 64 })).toMatchObject({ ok: false });
  });
  it("bounds actual extracted text and ZIP entry counts with tiny configured limits", async () => {
    expect(await parse(Buffer.from("Twelve chars"), "text/plain", { textCharacters: 5 })).toMatchObject({ ok: false });
    expect(await parse(zip([types, { name: "one.xml", text: "1" }, { name: "two.xml", text: "2" }]), pptx, { zipEntries: 2 })).toMatchObject({ ok: false });
  });
  it("rejects traversal and external XML resources", async () => {
    expect(await parse(zip([types, { name: "../outside.xml", text: "fixture" }]), pptx)).toMatchObject({ ok: false });
    expect(await parse(zip([types, { name: "ppt/slides/slide1.xml", text: '<!DOCTYPE test [<!ENTITY ext SYSTEM "https://fixture.invalid/private">]><a:t>&ext;</a:t>' }]), pptx)).toMatchObject({ ok: false });
  });
});
