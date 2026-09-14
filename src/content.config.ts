import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
// Imported directly rather than via the `z` re-export from astro:content,
// which is deprecated in Astro 7.
import { z } from 'zod';

/**
 * Content schemas.
 *
 * These are the guardrail for content written months apart. A case study
 * missing its summary, or with a `status` that is not one the design
 * renders, fails the build rather than rendering a gap.
 */

/** Where a project actually is, stated plainly. Ordered by maturity. */
const status = z.enum([
  'In production', // real users, real money or real consequences
  'Parked, pre-launch', // built and deployed, never publicly launched; workers off, development parked
  'Released', // shipped and usable, low or unknown usage
  'Archived', // no longer worked on
]);

const caseStudies = defineCollection({
  loader: glob({ base: './src/content/case-studies', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    /** One line under the title. Not a tagline — say what the system does. */
    summary: z.string(),
    /** Used for meta description and OG. Longer, still one sentence. */
    description: z.string(),
    status,
    /** Rendered as "2026 — present" or similar; free text by design. */
    period: z.string(),
    role: z.string(),
    /** Ordered; the first four show on the card. */
    stack: z.array(z.string()).min(1),
    /** Lower sorts first. Explicit so ordering is an editorial decision. */
    order: z.number(),
    /** Live product URL, when there is one to link. */
    url: z.url().optional(),
    /** Public source, when there is any. Most of this work is private. */
    repo: z.url().optional(),
    /** Set when the write-up is deliberately anonymised. Renders a notice. */
    anonymised: z.boolean().default(false),
    /** Two to four figures for the header readout. */
    metrics: z
      .array(
        z.object({
          label: z.string(),
          /** Key into src/data/metrics.json, so each figure lives in one place. */
          from: z.string().optional(),
          /** Literal value, for figures not in metrics.json. */
          value: z.union([z.string(), z.number()]).optional(),
        }),
      )
      .max(6)
      .default([]),
    draft: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** ISO date. Notes are dated; case studies are not. */
    date: z.coerce.date(),
    /** Short label for the index, e.g. "Infrastructure". */
    topic: z.string(),
    order: z.number(),
    repo: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { caseStudies, notes };
