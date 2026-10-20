import { localTargets } from "../support/local-targets.mjs";

type MailSummary = { messages?: Array<{ ID?: string }> };

async function messageIds(email: string): Promise<string[]> {
  const mailbox = localTargets().mailbox;
  const query = new URL("/api/v1/search", mailbox);
  query.searchParams.set("query", `to:${email}`);
  query.searchParams.set("limit", "20");
  const response = await fetch(query, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Local mailbox search failed.");
  const data = await response.json() as MailSummary;
  return (data.messages ?? []).map(message => message.ID).filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(id));
}

export async function currentMailIds(email: string) { return new Set(await messageIds(email)); }

function verifiedLocalLink(body: string): string | null {
  const targets = localTargets();
  const decoded = body.replaceAll("&amp;", "&").replaceAll("&#38;", "&");
  for (const candidate of decoded.match(/https?:\/\/[^\s<>"']+/g) ?? []) {
    try {
      const url = new URL(candidate.replace(/[).,;]+$/, ""));
      if ([targets.backend, targets.app].includes(url.origin) && (url.pathname.startsWith("/auth/v1/verify") || url.pathname === "/auth/callback")) return url.href;
    } catch { /* An email may contain unrelated malformed links. */ }
  }
  return null;
}

/** Read only a new disposable recovery email; never print or persist its token. */
export async function waitForRecoveryLink(email: string, before: Set<string>): Promise<string> {
  const mailbox = localTargets().mailbox;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const id of await messageIds(email)) {
      if (before.has(id)) continue;
      for (const extension of ["txt", "html"]) {
        const response = await fetch(`${mailbox}/view/${id}.${extension}`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const link = verifiedLocalLink(await response.text());
          if (link) return link;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("No new local recovery email arrived within 30 seconds.");
}
