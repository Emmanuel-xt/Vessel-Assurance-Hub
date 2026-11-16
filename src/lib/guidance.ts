// "How to check" guidance text (Question.guidance): one line per point.
// Plain line = bullet, "- " = sub-bullet, "Note: " = note. Pure, so the UI and tests share it.

export type GuidanceLine = { kind: "bullet" | "sub" | "note"; text: string };

export function parseGuidance(guidance: string): GuidanceLine[] {
  return guidance
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((text): GuidanceLine =>
      text.startsWith("- ")
        ? { kind: "sub", text: text.slice(2) }
        : /^note:/i.test(text)
          ? { kind: "note", text: text.replace(/^note:\s*/i, "") }
          : { kind: "bullet", text },
    );
}
