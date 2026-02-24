import fs from 'node:fs';
import path from 'node:path';

// ── Types ─────────────────────────────────────────────────────────────

export type ReviewStatus = 'adopt' | 'iterate' | 'keep' | 'drop' | 'skip';

export interface VariantReview {
  name: string;
  status: ReviewStatus | null;
  feedback: string | null;
  reviewedAt: string | null;
  applied?: boolean;
  iterateMode?: 'structural' | 'component' | 'auto';
  targetPart?: string;
  parent?: string;
}

export interface ComponentReview {
  path: string;
  variants: Record<string, VariantReview>;
}

export interface ReviewData {
  meta: {
    lastReviewed: string | null;
    currentGeneration: number;
  };
  components: Record<string, ComponentReview>;
}

// ── ReviewStore ───────────────────────────────────────────────────────

export class ReviewStore {
  private filePath: string;
  private data: ReviewData;

  constructor(opts: { file: string; root: string }) {
    this.filePath = path.resolve(opts.root, opts.file);
    this.data = this.load();
  }

  getData(): ReviewData {
    return this.data;
  }

  getComponentReview(component: string): ComponentReview | undefined {
    return this.data.components[component];
  }

  getVariantReview(component: string, variantId: string): VariantReview | undefined {
    return this.data.components[component]?.variants[variantId];
  }

  /** Update a single variant's review data */
  updateVariant(
    component: string,
    variantId: string,
    updates: {
      status?: ReviewStatus | null;
      feedback?: string | null;
      iterateMode?: 'structural' | 'component' | 'auto';
      targetPart?: string | null;
    },
  ): VariantReview {
    // Ensure component entry exists
    if (!this.data.components[component]) {
      this.data.components[component] = { path: '', variants: {} };
    }
    // Ensure variant entry exists
    if (!this.data.components[component].variants[variantId]) {
      this.data.components[component].variants[variantId] = {
        name: variantId,
        status: null,
        feedback: null,
        reviewedAt: null,
      };
    }

    const variant = this.data.components[component].variants[variantId];

    if (updates.status !== undefined) variant.status = updates.status;
    if (updates.feedback !== undefined) variant.feedback = updates.feedback;
    if (updates.iterateMode !== undefined) variant.iterateMode = updates.iterateMode;
    if (updates.targetPart !== undefined) variant.targetPart = updates.targetPart ?? undefined;

    variant.reviewedAt = new Date().toISOString();
    this.data.meta.lastReviewed = variant.reviewedAt;

    this.save();
    return variant;
  }

  /** Reload from disk (useful if external tool modified the file) */
  reload(): void {
    this.data = this.load();
  }

  // ── Internal ────────────────────────────────────────────────────────

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + '\n', 'utf-8');
  }

  private load(): ReviewData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {
        meta: { lastReviewed: null, currentGeneration: 1 },
        components: {},
      };
    }
  }
}
