import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KilnConfig, ResolvedKilnConfig } from './schema.js';
import { defaultConfig } from './schema.js';

const CONFIG_FILENAMES = ['kiln.config.ts', 'kiln.config.js', 'kiln.config.mjs'];

/**
 * Load kiln.config.ts from the project root and resolve with defaults.
 */
export async function loadConfig(root?: string): Promise<ResolvedKilnConfig> {
  const projectRoot = root ?? process.cwd();

  let userConfig: KilnConfig | undefined;

  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(projectRoot, filename);
    try {
      // Use dynamic import — tsx handles .ts transpilation at runtime
      const mod = await import(pathToFileURL(configPath).href);
      userConfig = mod.default ?? mod;
      break;
    } catch {
      // File doesn't exist or can't be imported — try next
    }
  }

  if (!userConfig) {
    throw new Error(
      `No kiln config found. Create one of: ${CONFIG_FILENAMES.join(', ')} in ${projectRoot}`,
    );
  }

  return resolveConfig(userConfig, projectRoot);
}

function resolveConfig(user: KilnConfig, root: string): ResolvedKilnConfig {
  return {
    name: user.name,
    root,

    variants: {
      include: user.variants?.include ?? defaultConfig.variants!.include,
      pattern: user.variants?.pattern ?? defaultConfig.variants!.pattern,
    },

    groups: user.groups ?? [],

    review: {
      file: user.review?.file ?? defaultConfig.review!.file,
    },

    preview: {
      framework: user.preview?.framework ?? 'react',
      css: user.preview?.css ?? [],
      vite: user.preview?.vite,
    },

    agents: {
      stateDir: user.agents?.stateDir ?? defaultConfig.agents!.stateDir,
      pollInterval: user.agents?.pollInterval ?? defaultConfig.agents!.pollInterval,
    },

    server: {
      port: user.server?.port ?? defaultConfig.server!.port,
    },
  };
}
