import { describe, expect, it } from 'vitest';
import { defineConfig } from '../src/config/define-config.js';
import { defaultConfig } from '../src/config/schema.js';

describe('defineConfig', () => {
  it('returns the config unchanged (it only exists for type inference)', () => {
    const config = {
      name: 'demo',
      variants: defaultConfig.variants!,
      review: { file: 'docs/variant-review.json' },
      preview: { framework: 'react' as const, css: [] },
      agents: { stateDir: '.kiln/agents/', pollInterval: 2000 },
      server: { port: 4400 },
    };
    expect(defineConfig(config)).toBe(config);
  });
});

describe('defaultConfig', () => {
  it('ships a variant pattern with component, generation and slot groups', () => {
    const m = 'Footer.v1a.tsx'.match(defaultConfig.variants!.pattern);
    expect(m?.slice(1)).toEqual(['Footer', '1', 'a']);
  });
});
