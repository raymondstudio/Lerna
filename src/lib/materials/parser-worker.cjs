"use strict";
async function runWorker() {
const { parentPort, workerData } = await import("node:worker_threads");
const { inflateRawSync } = await import("node:zlib");
const { createRequire } = await import("node:module");
const path = await import("node:path");
const dependency = createRequire(path.join(workerData.root, "package.json"));
const limits = workerData.limits;
const input = Buffer.from(workerData.buffer);
const normalize = (text) => text.replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
let characters = 0;
function segment(text, metadata = {}) {
  const normalized = normalize(text);
  characters += normalized.length;
  if (characters > limits.textCharacters) throw new Error("Extracted text exceeds the document limit.");
  return normalized ? { text: normalized, ...metadata } : null;
}
function zipEntries(buffer) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { eocd = offset; break; }
  }
  if (eocd < 0 || buffer.readUInt16LE(eocd + 4) || buffer.readUInt16LE(eocd + 6)) throw new Error("Unsupported ZIP container.");
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  if (!count || count > limits.zipEntries || count === 65535 || cursor + directorySize > eocd) throw new Error("ZIP entry limit exceeded.");
  if (buffer.readUInt16LE(eocd + 8) !== count) throw new Error("Unsupported multi-disk ZIP.");
  const entries = new Map();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > eocd || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP directory.");
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20), declared = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28), extra = buffer.readUInt16LE(cursor + 30), comment = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42), attributes = buffer.readUInt32LE(cursor + 38);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (!name || name.includes("\u0000") || name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name)
      || name.split("/").some((part) => part === ".." || part === ".") || entries.has(name) || ((attributes >>> 16) & 0xf000) === 0xa000) throw new Error("Unsafe ZIP entry.");
    if (flags & 1 || ![0, 8].includes(method) || declared > limits.zipEntryBytes || compressed > limits.fileBytes || local + 30 > buffer.length) throw new Error("Unsupported ZIP entry.");
    if (buffer.readUInt32LE(local) !== 0x04034b50 || (buffer.readUInt16LE(local + 6) & 1) || buffer.readUInt16LE(local + 8) !== method) throw new Error("Invalid ZIP entry header.");
    const localNameLength = buffer.readUInt16LE(local + 26), localExtra = buffer.readUInt16LE(local + 28);
    if (buffer.subarray(local + 30, local + 30 + localNameLength).toString("utf8") !== name) throw new Error("ZIP names do not match.");
    const start = local + 30 + localNameLength + localExtra;
    if (start + compressed > buffer.readUInt32LE(eocd + 16)) throw new Error("Invalid ZIP data range.");
    const data = method === 0 ? buffer.subarray(start, start + compressed)
      : inflateRawSync(buffer.subarray(start, start + compressed), { maxOutputLength: limits.zipEntryBytes + 1 });
    total += data.length;
    if (data.length !== declared || data.length > limits.zipEntryBytes || total > limits.zipExpandedBytes) throw new Error("ZIP expansion limit exceeded.");
    if (/(?:\.xml|\.rels)$/i.test(name) && /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(data.toString("utf8"))) throw new Error("External document resources are not supported.");
    entries.set(name, data);
    cursor += 46 + nameLength + extra + comment;
    if (cursor > eocd) throw new Error("Invalid ZIP directory size.");
  }
  return entries;
}
function textNodes(value, output = [], depth = 0) {
  if (depth > 40) throw new Error("Document XML nesting limit exceeded.");
  if (typeof value === "string" || typeof value === "number") output.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => textNodes(item, output, depth + 1));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "a:t" || key.endsWith(":t") || typeof item === "object") textNodes(item, output, depth + 1);
    }
  }
  return output;
}
async function parse() {
  const mime = workerData.mimeType;
  if (mime === "text/plain") return [segment(new TextDecoder("utf-8", { fatal: true }).decode(input))].filter(Boolean);
  if (mime.startsWith("image/")) {
    const sharp = dependency("sharp");
    const metadata = await sharp(input, { limitInputPixels: limits.pixels, animated: false }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > limits.dimension || metadata.height > limits.dimension
      || metadata.width * metadata.height > limits.pixels || (metadata.pages || 1) > 1) throw new Error("Image dimensions exceed the document limit.");
    return { image: true };
  }
  if (mime === "application/pdf") {
    const pdf = dependency("pdf-parse/lib/pdf-parse.js");
    const segments = [];
    let pages = 0;
    await pdf(input, { max: limits.pages + 1, pagerender: async (page) => {
      if (++pages > limits.pages) throw new Error("PDF page limit exceeded.");
      const content = await page.getTextContent();
      const item = segment(content.items.map((part) => part.str || "").join(" "), { page: pages });
      if (item) segments.push(item);
      return "";
    } });
    return segments;
  }
  const entries = zipEntries(input);
  if (!entries.has("[Content_Types].xml")) throw new Error("Invalid Office document.");
  if (mime.endsWith("wordprocessingml.document")) {
    if (!entries.has("word/document.xml")) throw new Error("File is not a DOCX document.");
    const mammoth = dependency("mammoth");
    const result = await mammoth.extractRawText({ buffer: input });
    return [segment(result.value || "")].filter(Boolean);
  }
  const slides = [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
  if (!slides.length || slides.length > limits.pages) throw new Error("Presentation slide limit exceeded.");
  const { XMLParser } = dependency("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
  return slides.map((name) => segment(textNodes(parser.parse(entries.get(name).toString("utf8"))).join("\n"), { slide: Number(name.match(/slide(\d+)/)[1]) })).filter(Boolean);
}
parse().then((result) => parentPort.postMessage({ ok: true, result }), () => parentPort.postMessage({ ok: false, error: "Document parsing failed or exceeded a supported limit." }));

}
void runWorker();
