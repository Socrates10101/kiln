import { describe, expect, it } from 'vitest';
import { parseVariantFilename } from '../src/stores/variant-filename.js';
import { defaultConfig } from '../src/config/schema.js';

const pattern = defaultConfig.variants!.pattern;

describe('parseVariantFilename', () => {
  it('parses the default <Component>.v<gen><slot>.tsx convention', () => {
    expect(parseVariantFilename('HeroSection.v2b.tsx', pattern)).toEqual({
      component: 'HeroSection',
      generation: 2,
      slot: 'b',
      variantId: 'v2b',
    });
  });

  it('keeps dots inside the component name', () => {
    expect(parseVariantFilename('Nav.Mobile.v10c.tsx', pattern)).toMatchObject({
      component: 'Nav.Mobile',
      generation: 10,
      variantId: 'v10c',
    });
  });

  it('returns null for files that are not variants', () => {
    expect(parseVariantFilename('HeroSection.tsx', pattern)).toBeNull();
    expect(parseVariantFilename('HeroSection.v2.tsx', pattern)).toBeNull();
    expect(parseVariantFilename('HeroSection.v2b.css', pattern)).toBeNull();
    expect(parseVariantFilename('HeroSection.v2B.tsx', pattern)).toBeNull();
  });

  it('honours a custom pattern from kiln.config.ts', () => {
    const custom = /^(.+)__g(\d+)([a-z])\.vue$/;
    expect(parseVariantFilename('Card__g3a.vue', custom)).toEqual({
      component: 'Card',
      generation: 3,
      slot: 'a',
      variantId: 'v3a',
    });
  });
});
