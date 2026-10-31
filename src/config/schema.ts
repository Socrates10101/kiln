import type { Plugin as VitePlugin, UserConfig as ViteUserConfig } from 'vite';

// ── Config types ──────────────────────────────────────────────────────

export interface ComponentGroup {
  /** Display name for the group (e.g. "Homepage", "Pricing") */
  name: string;
  /** Component names in display order */
  components: string[];
  /** Path to the actual page file (relative to project root). When set, group preview renders using the real page layout. */
  pageFile?: string;
}

export interface KilnConfig {
  name: string;

  /** Variant file discovery */
  variants: {
    /** Glob pattern(s) for finding variant files */
    include: string[];
    /** Regex to parse component name, generation, slot from filename */
    pattern: RegExp;
  };

  /** Component groups (e.g. page-level grouping) */
  groups?: ComponentGroup[];

  /** Review persistence */
  review: {
    /** Path to the review JSON file (relative to project root) */
    file: string;
  };

  /** Preview rendering */
  preview: {
    /** UI framework for rendering components */
    framework: 'react';
    /** CSS files to load in preview */
    css: string[];
    /** Extra Vite config for preview builds */
    vite?: {
      plugins?: VitePlugin[];
      resolve?: ViteUserConfig['resolve'];
    };
  };

  /** Agent monitoring */
  agents: {
    /** Directory for agent state files */
    stateDir: string;
    /** Polling interval in ms */
    pollInterval: number;
  };

  /** Server settings */
  server: {
    port: number;
  };
}

// ── Resolved config (with defaults applied) ───────────────────────────

export interface ResolvedKilnConfig extends KilnConfig {
  /** Absolute path to project root */
  root: string;
}

// ── Defaults ──────────────────────────────────────────────────────────

export const defaultConfig: Partial<KilnConfig> = {
  variants: {
    include: ['src/**/*.v*.tsx'],
    pattern: /^(.+)\.v(\d+)([a-z])\.tsx$/,
  },
  review: {
    file: 'docs/variant-review.json',
  },
  agents: {
    stateDir: '.kiln/agents/',
    pollInterval: 2000,
  },
  server: {
    port: 4400,
  },
};
