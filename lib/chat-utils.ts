export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ActionBlock {
  action: string;
  [key: string]: unknown;
}

const OPEN = "{";
const CLOSE = "}";
const KEY = "action";

function tryParseAction(candidate: string): ActionBlock | null {
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(parsed, KEY)
      ? (parsed as ActionBlock)
      : null;
  } catch (_e) {
    return null;
  }
}

export function extractActions(text: string): { cleaned: string; actions: ActionBlock[] } {
  if (!text.includes(KEY)) {
    return { cleaned: text, actions: [] };
  }
  const actions: ActionBlock[] = [];
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    const openIdx = text.indexOf(OPEN, i);
    if (openIdx === -1) {
      parts.push(text.slice(i));
      break;
    }
    parts.push(text.slice(i, openIdx));
    let depth = 0;
    let j = openIdx;
    while (j < text.length) {
      if (text[j] === OPEN) depth += 1;
      else if (text[j] === CLOSE) {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    const candidate = text.slice(openIdx, j + 1);
    const parsed = tryParseAction(candidate);
    if (parsed) {
      actions.push(parsed);
      i = j + 1;
      while (i < text.length && text[i] === "\n") {
        i += 1;
      }
    } else {
      parts.push(candidate);
      i = j + 1;
    }
  }
  const joined = parts.join("");
  const cleaned = joined.replace(/\n\n\n+/g, "\n\n").trim();
  return { cleaned, actions };
}
