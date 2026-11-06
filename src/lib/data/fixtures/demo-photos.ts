// MOCK: placeholder "photos" for the demo history. Nothing is stored: the photo store draws the image from its id
// when asked (src/lib/data/mock/photo-store.ts), so they cost no storage and survive every reset.
// Each one is a small SVG scene (sky, sea, deck, a simple object) captioned "Demo photo · <subject>", so nobody
// mistakes it for real evidence. Production: remove (CLAUDE.md §14).

import { MODULE_CONTENT } from "./demo-content";

export const DEMO_PHOTO_PREFIX = "demo-photo-";
export const DEMO_PHOTO_SIZE = { width: 320, height: 240 } as const;

/** "demo-photo-<moduleId>-<n>", e.g. "demo-photo-mod-bunkering-007". */
export function demoPhotoId(moduleId: string, n: number): string {
  return `${DEMO_PHOTO_PREFIX}${moduleId}-${String(n).padStart(3, "0")}`;
}

export function isDemoPhotoId(id: string): boolean {
  return id.startsWith(DEMO_PHOTO_PREFIX);
}

function parse(id: string): { moduleId: string; n: number } | null {
  const match = /^demo-photo-(mod-[a-z-]+)-(\d+)$/.exec(id);
  return match ? { moduleId: match[1], n: Number(match[2]) } : null;
}

/** What the photo shows, from its module's photo subjects. */
export function demoPhotoSubject(id: string): string | null {
  const parsed = parse(id);
  if (!parsed) return null;
  const subjects = MODULE_CONTENT[parsed.moduleId]?.photos ?? ["On board"];
  return subjects[parsed.n % subjects.length];
}

const SKIES = [
  ["#9cc3e0", "#dbe9f3"], // clear
  ["#a7b2bd", "#d7dde2"], // overcast
  ["#f0b98a", "#fbe3c8"], // early morning
];
const SEAS = ["#2f6d8f", "#3b5f75", "#245c74"];
const DECKS = ["#8a8f94", "#7d8a7f", "#94897a"];

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A simple object in the middle of the deck, chosen by the subject's wording. */
function glyph(subject: string, x: number): string {
  const s = subject.toLowerCase();
  if (/hose|coupling/.test(s))
    return `<path d="M${x - 70} 175 C${x - 30} 120 ${x + 10} 210 ${x + 70} 150" fill="none" stroke="#1d1d1d" stroke-width="14" stroke-linecap="round"/><rect x="${x + 62}" y="138" width="22" height="22" rx="3" fill="#c9a227"/>`;
  if (/meter|detector|thermometer|reading|gauge/.test(s))
    return `<rect x="${x - 34}" y="108" width="68" height="92" rx="10" fill="#f2c230" stroke="#333" stroke-width="3"/><rect x="${x - 24}" y="120" width="48" height="30" rx="3" fill="#cfe8cf"/><text x="${x}" y="142" font-family="monospace" font-size="16" text-anchor="middle" fill="#123">20.9</text><circle cx="${x}" cy="178" r="9" fill="#333"/>`;
  if (/tag|lanyard|sling|harness|lock/.test(s))
    return `<path d="M${x - 30} 112 h60 l14 22 v62 h-88 v-62z" fill="#e8e2c8" stroke="#555" stroke-width="3"/><circle cx="${x}" cy="128" r="6" fill="#555"/><rect x="${x - 26}" y="146" width="52" height="6" fill="#999"/><rect x="${x - 26}" y="160" width="40" height="6" fill="#999"/><rect x="${x - 26}" y="174" width="46" height="6" fill="#c33"/>`;
  if (/board|log|record|register|permit|plan|sheet|file|tracker|folder|printout|card/.test(s))
    return `<rect x="${x - 60}" y="96" width="120" height="100" rx="4" fill="#f7f5ef" stroke="#6b5b45" stroke-width="5"/>${[112, 128, 144, 160, 176]
      .map((y, i) => `<rect x="${x - 48}" y="${y}" width="${[88, 70, 92, 60, 80][i]}" height="6" fill="#9aa4ad"/>`)
      .join("")}`;
  if (/boat|basket|container|cargo|lashing/.test(s))
    return `<rect x="${x - 64}" y="118" width="128" height="70" fill="#c0392b"/>${[0, 1, 2, 3, 4, 5]
      .map((i) => `<rect x="${x - 58 + i * 21}" y="124" width="6" height="58" fill="#9b2c21"/>`)
      .join("")}`;
  return `<rect x="${x - 46}" y="112" width="92" height="84" rx="6" fill="#d0d4d8" stroke="#555" stroke-width="3"/><rect x="${x - 30}" y="128" width="60" height="12" fill="#e0b84a"/><circle cx="${x}" cy="170" r="12" fill="#666"/>`;
}

/** The SVG markup for a demo photo id (deterministic), or null if the id is not a demo photo. */
export function demoPhotoSvg(id: string): string | null {
  const parsed = parse(id);
  const subject = demoPhotoSubject(id);
  if (!parsed || !subject) return null;
  const v = parsed.n;
  const [sky1, sky2] = SKIES[v % SKIES.length];
  const sea = SEAS[(v >> 1) % SEAS.length];
  const deck = DECKS[(v >> 2) % DECKS.length];
  const tilt = (v % 5) * 6;
  const x = 130 + ((v * 37) % 60);
  const { width, height } = DEMO_PHOTO_SIZE;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#s)"/>` +
    `<rect y="104" width="${width}" height="60" fill="${sea}"/>` +
    `<path d="M0 ${168 - tilt} L${width} ${150 + tilt} L${width} ${height} L0 ${height}Z" fill="${deck}"/>` +
    `<path d="M0 ${176 - tilt} L${width} ${158 + tilt}" stroke="#f1c40f" stroke-width="4" stroke-dasharray="18 10"/>` +
    glyph(subject, x) +
    `<rect y="204" width="${width}" height="36" fill="#000" fill-opacity="0.6"/>` +
    `<text x="12" y="227" font-family="system-ui, sans-serif" font-size="14" fill="#fff">Demo photo · ${escapeXml(subject)}</text>` +
    `</svg>`
  );
}
