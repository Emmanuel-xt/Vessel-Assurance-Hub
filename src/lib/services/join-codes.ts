// Join codes for Start Work Check activities: short, easy to read out on deck, no look-alike characters.

/** No 0/O, 1/I/L: a code read out over a radio or written on a whiteboard is hard to get wrong. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

/** Builds a code from random numbers in [0, 1) (crypto in the data layer, a seeded stream in the fixtures). */
export function joinCodeFrom(random: () => number): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** What someone typed → the stored form: upper case, spaces and dashes dropped. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "K7P4QX" → "K7P-4QX" for display. */
export function formatJoinCode(code: string): string {
  return code.length === JOIN_CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}
