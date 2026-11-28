// result: a delivered result — a draft, a comparison, an answer — with sources and the model that made it.
import { clean, https, str, type Trail } from "../../core/fields";

export type ResultSource = { label: string; url?: string };
export type ResultBlock = { type: "result"; title?: string; body: string; sources?: ResultSource[]; model?: string };

const MAX_SOURCES = 6;

export function readResult(raw: any, here: Trail): ResultBlock | null {
  const body = str(raw.body, 2000);
  if (!body) return here.drop("result needs body text");
  const sources = Array.isArray(raw.sources)
    ? (raw.sources
        .map((s: any) => {
          const label = s && typeof s === "object" ? str(s.label, 80) : undefined;
          return label ? clean({ label, url: https(s.url) }) : null;
        })
        .filter(Boolean) as ResultSource[]).slice(0, MAX_SOURCES)
    : [];
  return clean({
    type: "result" as const,
    title: str(raw.title, 80),
    body,
    sources: sources.length ? sources : undefined,
    model: str(raw.model, 60),
  });
}
