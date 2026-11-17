import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// The isolated parser resolves modules at runtime, outside Next's static graph.
// Trace the installed dependency closure, including hoisted packages and Sharp's
// platform-specific @img assets, rather than only each top-level package directory.
function parserRuntimeFiles() {
  const seen = new Set<string>();
  const include = ["./src/lib/materials/parser-worker.cjs"];
  function visit(name: string, parent: string) {
    const loader = createRequire(parent);
    const file = (loader.resolve.paths(name) ?? []).map(directory => path.join(directory, name, "package.json")).find(existsSync);
    if (!file || seen.has(file)) return;
    seen.add(file);
    const relative = path.relative(process.cwd(), path.dirname(file)).replaceAll("\\", "/");
    if (relative.startsWith("../")) throw new Error("Parser dependencies must be installed in the project.");
    include.push(`./${relative}/**/*`);
    const manifest = JSON.parse(readFileSync(file, "utf8")) as { dependencies?: Record<string,string>; optionalDependencies?: Record<string,string> };
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) visit(dependency, file);
  }
  for (const name of ["pdf-parse", "mammoth", "fast-xml-parser", "sharp"]) visit(name, path.join(process.cwd(), "package.json"));
  return include;
}
const parserFiles = parserRuntimeFiles();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/upload": parserFiles,
    "/api/materials": parserFiles,
    "/api/materials/*/process": parserFiles,
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
