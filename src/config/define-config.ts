import type { KilnConfig } from './schema.js';

/**
 * Type-safe config helper. Returns the config as-is — purely for IDE autocompletion.
 */
export function defineConfig(config: KilnConfig): KilnConfig {
  return config;
}
