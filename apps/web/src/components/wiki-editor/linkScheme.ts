// Internal links reach the renderers in two spellings: `wiki:<id>` (what the
// link modal and the @-mention menu insert) and `wiki://<id>` (what generated
// content, e.g. the Second Brain actions, writes). Same for `task:`. Matching
// only one of them silently turns the link into an inert anchor.
export function parseSchemeId(
  href: string,
  scheme: "wiki" | "task",
): string | null {
  if (!href.startsWith(`${scheme}:`)) return null;
  const id = href.slice(scheme.length + 1).replace(/^\/\//, "");
  return id || null;
}
