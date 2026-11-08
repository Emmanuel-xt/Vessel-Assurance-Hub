/**
 * Only a same-site path is accepted as a post-login destination. Rejects "//evil.example" and "/\evil.example"
 * (browsers read a backslash as a slash), and control characters that browsers strip from URLs.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
