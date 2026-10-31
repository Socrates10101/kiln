import fs from 'node:fs';
import path from 'node:path';
import { watch } from 'chokidar';
import type { EventBus } from '../events/event-bus.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface VariantInfo {
  /** e.g. "v3a" */
  id: string;
  /** e.g. "Split Horizon" — extracted from JSDoc */
  name: string;
  /** Generation number (numeric part of id) */
  generation: number;
  /** Slot letter */
  slot: string;
  /** Relative file path from project root */
  file: string;
}

export interface ComponentEntry {
  /** Component name (e.g. "HeroSection") */
  name: string;
  /** Relative directory path */
  dir: string;
  /** Variant map: variantId → VariantInfo */
  variants: Map<string, VariantInfo>;
}

// ── JSDoc name extraction patterns ────────────────────────────────────

const JSDOC_NAMED_RE = /\/\*\*\s*\*?\s*v\d+[a-z]:\s*(.+?)\s*\(Gen\s*\d+\)\s*\*?\s*\*\//;
const JSDOC_SIMPLE_RE = /\/\*\*\s*\*?\s*v\d+[a-z]:\s*(.+?)\s*\*?\s*\*\//;
const JSDOC_DASH_RE = /\/\*\*\s*\*?\s*(.+?)\s*(?:--|---)\s*.+?\s*\*?\s*\*\//;

function extractVariantName(filePath: string, variantId: string): string {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(500);
    fs.readSync(fd, buf, 0, 500, 0);
    fs.closeSync(fd);
    const head = buf.toString('utf-8');

    let match: RegExpMatchArray | null;

    match = head.match(JSDOC_NAMED_RE);
    if (match) return match[1].trim();

    match = head.match(JSDOC_SIMPLE_RE);
    if (match) return match[1].trim();

    match = head.match(JSDOC_DASH_RE);
    if (match) return match[1].trim();
  } catch {
    // ignore
  }
  return variantId;
}

// ── VariantManifest ───────────────────────────────────────────────────

export class VariantManifest {
  private root: string;
  private includePatterns: string[];
  private filenamePattern: RegExp;
  private bus: EventBus;
  private components = new Map<string, ComponentEntry>();
  private watcher: ReturnType<typeof watch> | null = null;

  constructor(opts: {
    root: string;
    include: string[];
    pattern: RegExp;
    bus: EventBus;
  }) {
    this.root = opts.root;
    this.includePatterns = opts.include;
    this.filenamePattern = opts.pattern;
    this.bus = opts.bus;
  }

  /** Initial scan + start watching */
  start(): void {
    this.scan();
    this.startWatching();
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  getComponents(): ComponentEntry[] {
    return [...this.components.values()];
  }

  getComponent(name: string): ComponentEntry | undefined {
    return this.components.get(name);
  }

  /** Get the full manifest as a serializable object */
  toJSON(): Record<string, { dir: string; variants: Record<string, VariantInfo> }> {
    const result: Record<string, { dir: string; variants: Record<string, VariantInfo> }> = {};
    for (const [name, entry] of this.components) {
      result[name] = {
        dir: entry.dir,
        variants: Object.fromEntries(entry.variants),
      };
    }
    return result;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private scan(): void {
    for (const pattern of this.includePatterns) {
      // 'src/**/*.v*.tsx' → 'src', '.kiln/variants/**/*.v*.tsx' → '.kiln/variants'
      const base = pattern.split('*')[0].replace(/\/+$/, '') || '.';
      const scanDir = path.join(this.root, base);
      if (fs.existsSync(scanDir)) {
        this.walkDir(scanDir);
      }
    }
  }

  private walkDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath);
      } else if (entry.isFile()) {
        this.processFile(fullPath, entry.name);
      }
    }
  }

  private processFile(fullPath: string, filename: string): string | null {
    const match = filename.match(this.filenamePattern);
    if (!match) return null;

    const componentName = match[1];
    const generation = parseInt(match[2], 10);
    const slot = match[3];
    const variantId = `v${generation}${slot}`;
    const relDir = path.relative(this.root, path.dirname(fullPath));
    const relFile = path.relative(this.root, fullPath);
    const name = extractVariantName(fullPath, variantId);

    if (!this.components.has(componentName)) {
      this.components.set(componentName, {
        name: componentName,
        dir: relDir,
        variants: new Map(),
      });
    }

    const entry = this.components.get(componentName)!;
    entry.variants.set(variantId, {
      id: variantId,
      name,
      generation,
      slot,
      file: relFile,
    });

    return variantId;
  }

  private startWatching(): void {
    const patterns = this.includePatterns.map((p) => path.join(this.root, p));

    this.watcher = watch(patterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    this.watcher.on('add', (filePath) => {
      const filename = path.basename(filePath);
      const variantId = this.processFile(filePath, filename);
      if (variantId) {
        const match = filename.match(this.filenamePattern);
        if (match) {
          this.bus.emit({
            type: 'variant:discovered',
            component: match[1],
            variantId,
          });
        }
      }
    });

    this.watcher.on('change', (filePath) => {
      const filename = path.basename(filePath);
      const variantId = this.processFile(filePath, filename);
      if (variantId) {
        const match = filename.match(this.filenamePattern);
        if (match) {
          this.bus.emit({
            type: 'variant:changed',
            component: match[1],
            variantId,
          });
        }
      }
    });

    this.watcher.on('unlink', (filePath) => {
      const filename = path.basename(filePath);
      const match = filename.match(this.filenamePattern);
      if (!match) return;

      const componentName = match[1];
      const generation = parseInt(match[2], 10);
      const slot = match[3];
      const variantId = `v${generation}${slot}`;

      const entry = this.components.get(componentName);
      if (entry) {
        entry.variants.delete(variantId);
        if (entry.variants.size === 0) {
          this.components.delete(componentName);
        }
      }

      this.bus.emit({
        type: 'variant:removed',
        component: componentName,
        variantId,
      });
    });
  }
}
