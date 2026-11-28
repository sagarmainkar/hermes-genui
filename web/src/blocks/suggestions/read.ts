// suggestions: proposed changes to accept or skip, each with a reason. Accept/skip send their message.
import { actsBeforeTheModel, clean, keepFirst, NO_SEND, str, type Trail } from "../../core/fields";

export type SuggestionItem = { text: string; reason?: string; accept?: string; skip?: string };
export type SuggestionsBlock = { type: "suggestions"; title?: string; items: SuggestionItem[] };

const MAX_SUG = 20;

export function readSuggestions(raw: any, here: Trail): SuggestionsBlock | null {
  const list = Array.isArray(raw.items) ? raw.items : undefined;
  if (!list) return here.drop("suggestions needs items");
  const items: SuggestionItem[] = [];
  list.forEach((item: any, i: number) => {
    if (!item || typeof item !== "object") { here.at("items").at(i).drop("suggestion needs text"); return; }
    const text = str(item.text, 200);
    if (!text) { here.at("items").at(i).drop("suggestion needs text"); return; }
    if (actsBeforeTheModel(item.accept) || actsBeforeTheModel(item.skip)) { here.at("items").at(i).drop(NO_SEND); return; }
    items.push(clean({ text, reason: str(item.reason, 200), accept: str(item.accept, 300), skip: str(item.skip, 300) }));
  });
  if (!items.length) return here.drop("suggestions has no suggestion with text");
  return clean({ type: "suggestions" as const, title: str(raw.title, 80), items: keepFirst(items, MAX_SUG, here, "suggestions") });
}
