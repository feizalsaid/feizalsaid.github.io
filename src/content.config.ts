import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Writeup content collection.
 *
 * Each markdown file in `src/content/writeups/` becomes its own static page
 * at `/writeups/<slug>` via the `getStaticPaths()` in `.pages/writeups/[slug].astro`.
 */
const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    description: z.string().describe('SEO meta description / card summary'),
    date: z.coerce.date(),
    /** High-level grouping: offensive | defensive | ai */
    category: z.enum(['offensive', 'defensive', 'ai']).default('defensive'),
    readTime: z.string().default('5 min read'),
    /** Comma-separated or array of MITRE ATT&CK technique IDs, e.g. ["T1110.001", "T1021.001"] */
    mitre: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    summary: z.string().default(''),
  }),
});

export const collections = { writeups };
