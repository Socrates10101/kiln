// ── Variant filename parsing ──────────────────────────────────────────
//
// Variant files follow `<Component>.v<generation><slot>.tsx`, e.g.
// `HeroSection.v2b.tsx`. The regex is user-configurable via
// `variants.pattern` in kiln.config.ts; it must expose three capture
// groups: component name, generation number, slot letter.

export interface ParsedVariantFilename {
  /** Component name, e.g. "HeroSection" */
  component: string;
  /** Generation number, e.g. 2 */
  generation: number;
  /** Slot letter, e.g. "b" */
  slot: string;
  /** Variant id, e.g. "v2b" */
  variantId: string;
}

/**
 * Parse a variant filename with the configured pattern.
 * Returns null when the filename does not match.
 */
export function parseVariantFilename(
  filename: string,
  pattern: RegExp,
): ParsedVariantFilename | null {
  const match = filename.match(pattern);
  if (!match) return null;

  const component = match[1];
  const generation = parseInt(match[2], 10);
  const slot = match[3];

  if (!component || Number.isNaN(generation) || !slot) return null;

  return { component, generation, slot, variantId: `v${generation}${slot}` };
}
