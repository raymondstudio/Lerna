export function sanitizeAuthReturnPath(value: string | null | undefined, fallback = "/chat") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://internal.lerna.invalid");
    if (parsed.origin !== "https://internal.lerna.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
