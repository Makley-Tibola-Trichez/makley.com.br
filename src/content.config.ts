import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

import { PROJECT_CATEGORIES } from './domain/projects/project.entity';
import { TECH_CATEGORIES } from './domain/tech-stack/technology.entity';
import { EDUCATION_KINDS } from './domain/education/education.entity';

/**
 * Content Collections act as the **anti-corruption layer** between hand-edited
 * files and the domain model.
 *
 * The Zod schemas below are the only place raw content is trusted. They run at
 * build time, so a typo in a date, a missing `alt` text or an unknown category
 * breaks `npm run build` instead of silently rendering a broken page. Mappers in
 * `src/infrastructure` then turn these validated shapes into domain entities.
 *
 * Note the categories are imported *from the domain* rather than re-declared:
 * adding a project category is a one-line change in the entity, and the schema
 * follows automatically.
 */

/**
 * Takes the whole `SchemaContext` rather than a loosely typed `image` callback:
 * that preserves Astro's `ImageMetadata` return type, so `image` stays required
 * and non-`any` all the way through to the domain entity.
 */
const describedImageSchema = ({ image }: SchemaContext) =>
  z.object({
    image: image(),
    alt: z.string().min(8, 'Descreva a imagem para leitores de tela'),
    caption: z.string().optional(),
  });

const externalLinkSchema = z.object({
  url: z.string().url(),
  label: z.string(),
  kind: z
    .enum(['website', 'repository', 'demo', 'article', 'case-study', 'store', 'other'])
    .default('other'),
});

/** `2021-11` — authors never type full dates, so ranges stay unambiguous. */
const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM (ex.: 2021-11)');

const metricSchema = z.object({
  value: z.string(),
  label: z.string(),
  detail: z.string().optional(),
});

const focusAreaSchema = z.object({ title: z.string(), description: z.string() });
const languageSchema = z.object({ name: z.string(), level: z.string() });

const profile = defineCollection({
  // Only the canonical file — locale overrides (`main.<locale>.yaml`) live in
  // the `profileTranslations` collection below, validated against a partial
  // schema, so they never have to satisfy every required field here.
  loader: glob({ base: './src/content/profile', pattern: 'main.yaml' }),
  schema: (context) =>
    z.object({
      name: z.string(),
      shortName: z.string(),
      /** Shown under the hero headline; keep under ~90 chars. */
      headline: z.string().max(120),
      title: z.string(),
      /**
       * The hero headline, split so the emphasised word can be rendered in the
       * display serif without HTML living inside the content file.
       */
      heroStatement: z.object({
        lead: z.string(),
        emphasis: z.string(),
        trail: z.string(),
      }),
      heroIntro: z.string(),
      bio: z.array(z.string()).min(1),
      location: z.string(),
      locality: z.string(),
      region: z.string(),
      country: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      availability: z.enum(['open', 'selective', 'closed']),
      availabilityNote: z.string(),
      specialties: z.array(z.string()),
      focusAreas: z.array(focusAreaSchema),
      goals: z.array(z.string()),
      languages: z.array(languageSchema),
      stats: z.array(metricSchema),
      socials: z.array(
        z.object({
          platform: z.enum([
            'github',
            'linkedin',
            'instagram',
            'email',
            'phone',
            'hackerrank',
            'resume',
          ]),
          url: z.string(),
          handle: z.string(),
          primary: z.boolean().default(false),
        }),
      ),
      resumePath: z.string(),
      avatar: describedImageSchema(context).optional(),
    }),
});

/**
 * Optional per-locale override of the profile's translatable prose fields.
 * Naming convention: `main.<locale>.yaml` (e.g. `main.en.yaml`) — there is no
 * `main.pt-BR.yaml` because pt-BR *is* `main.yaml`. A missing file for a
 * locale is not an error: the repository just falls back to the canonical
 * field, so translators only ever write what actually changes.
 */
const profileTranslations = defineCollection({
  loader: glob({
    base: './src/content/profile',
    pattern: 'main.*.yaml',
    generateId: ({ entry }) => entry.replace(/^main\.(.+)\.yaml$/, '$1'),
  }),
  schema: z.object({
    title: z.string().optional(),
    headline: z.string().max(120).optional(),
    heroStatement: z
      .object({
        lead: z.string(),
        emphasis: z.string(),
        trail: z.string(),
      })
      .optional(),
    heroIntro: z.string().optional(),
    bio: z.array(z.string()).min(1).optional(),
    location: z.string().optional(),
    availabilityNote: z.string().optional(),
    specialties: z.array(z.string()).optional(),
    focusAreas: z.array(focusAreaSchema).optional(),
    goals: z.array(z.string()).optional(),
    languages: z.array(languageSchema).optional(),
    stats: z.array(metricSchema).optional(),
    resumePath: z.string().optional(),
  }),
});

const projects = defineCollection({
  // Markdown, not YAML: the body holds the long-form case study rendered on the
  // detail page, while the frontmatter stays strictly typed. The negation
  // excludes locale overrides (`<slug>.<locale>.md`, handled by
  // `projectBodyTranslations` below) — see the `experience` collection for why.
  loader: glob({ base: './src/content/projects', pattern: ['**/*.md', '!*.*.md'] }),
  schema: (context) =>
    z.object({
      title: z.string(),
      tagline: z.string().max(160),
      category: z.enum(PROJECT_CATEGORIES),
      year: z.number().int().min(2018).max(2100),
      role: z.string(),
      context: z.string(),
      summary: z.string(),
      problem: z.string(),
      solution: z.string(),
      challenges: z.array(z.string()).min(1),
      results: z.array(metricSchema),
      technologies: z.array(z.string()).min(1),
      cover: describedImageSchema(context).optional(),
      gallery: z.array(describedImageSchema(context)).default([]),
      links: z.array(externalLinkSchema).default([]),
      featured: z.boolean().default(false),
      order: z.number().int().default(999),
      confidential: z.boolean().default(false),
      /** Excluded from the site without deleting the file. */
      draft: z.boolean().default(false),
    }),
});

/**
 * Optional per-locale override of a project's translatable fields — covers
 * both the catalog card (`title`/`tagline`/`results`) and the detail page
 * (`context`/`problem`/`solution`/`challenges`/`links`). The long-form
 * markdown body is a separate collection (`projectBodyTranslations` below)
 * since Content Layer schemas can't mix a YAML frontmatter shape with a
 * Markdown body in one collection. Naming convention: `<slug>.<locale>.yaml`.
 */
const projectTranslations = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '*.yaml',
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: z.object({
    title: z.string().optional(),
    tagline: z.string().max(160).optional(),
    summary: z.string().optional(),
    role: z.string().optional(),
    results: z.array(metricSchema).optional(),
    context: z.string().optional(),
    problem: z.string().optional(),
    solution: z.string().optional(),
    challenges: z.array(z.string()).min(1).optional(),
    /**
     * `technologies` is canonical/untranslated for every project except
     * `llm-em-dispositivos-moveis` and `portfolio`, whose lists use
     * descriptive pt-BR phrases (e.g. "Inteligência Artificial", "CSS
     * moderno") in place of real proper-noun tool names.
     */
    technologies: z.array(z.string()).min(1).optional(),
    /**
     * Only `alt` is overridable — `image` isn't part of this partial shape
     * on purpose, so the canonical cover image is never accidentally
     * dropped by the merge (see `mergeProjectTranslation`).
     */
    cover: z.object({ alt: z.string().min(8).optional() }).optional(),
    links: z.array(externalLinkSchema).optional(),
  }),
});

/**
 * Optional per-locale translation of a project's long-form case-study body
 * (the markdown below the frontmatter in `<slug>.md`). Naming convention:
 * `<slug>.<locale>.md` (e.g. `agronota.en.md`) — frontmatter is empty or
 * absent, only the body is read via `render()`. No override for a slug/locale
 * pair simply falls back to the canonical pt-BR body.
 */
const projectBodyTranslations = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '*.*.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({}),
});

const achievementSchema = z.object({ value: z.string(), label: z.string() });

const experience = defineCollection({
  // The negation excludes locale overrides (`<name>.<locale>.yaml`, handled
  // by `experienceTranslations` below) — without it this pattern would also
  // match them and fail schema validation (they lack required fields).
  loader: glob({ base: './src/content/experience', pattern: ['*.yaml', '!*.*.yaml'] }),
  schema: z.object({
    company: z.string(),
    companyUrl: z.string().url().optional(),
    role: z.string(),
    seniority: z.string().optional(),
    start: yearMonth,
    end: yearMonth.nullable().default(null),
    location: z.string(),
    employmentType: z.enum(['clt', 'pj', 'estagio', 'freelance', 'proprio']).default('clt'),
    summary: z.string(),
    responsibilities: z.array(z.string()).min(1),
    achievements: z.array(achievementSchema).default([]),
    technologies: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/**
 * Optional per-locale override of an experience entry's translatable fields.
 * Naming convention: `<filename>.<locale>.yaml` (e.g. `01-sicredi.en.yaml`).
 * `company` and `technologies` stay canonical (proper nouns).
 */
const experienceTranslations = defineCollection({
  loader: glob({
    base: './src/content/experience',
    pattern: '*.*.yaml',
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: z.object({
    /**
     * `company` is canonical/untranslated for every entry except
     * `03-produto-proprio` — that one names a not-yet-public product by its
     * description ("Own product") rather than a real proper noun, so it's the
     * lone entry that overrides this optional field.
     */
    company: z.string().optional(),
    role: z.string().optional(),
    seniority: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
    responsibilities: z.array(z.string()).min(1).optional(),
    achievements: z.array(achievementSchema).optional(),
    /**
     * Canonical/untranslated for every entry except `01-sicredi`, whose list
     * includes "Microsserviços" — a descriptive pt-BR term, not a proper
     * noun like the rest of the tools around it.
     */
    technologies: z.array(z.string()).optional(),
  }),
});

const education = defineCollection({
  // See the `experience` collection above for why overrides are excluded.
  loader: glob({ base: './src/content/education', pattern: ['*.yaml', '!*.*.yaml'] }),
  schema: z.object({
    institution: z.string(),
    credential: z.string(),
    kind: z.enum(EDUCATION_KINDS),
    start: yearMonth,
    end: yearMonth.nullable().default(null),
    field: z.string().optional(),
    description: z.string().optional(),
    highlights: z.array(z.string()).default([]),
    credentialUrl: z.string().url().optional(),
    // Without this, an entry with no `end` collapses to a point in time (see
    // the mapper) — set `true` for a multi-month credential still running
    // (e.g. an ongoing postgraduate program).
    inProgress: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/**
 * Optional per-locale override of an education entry's translatable fields.
 * Naming convention: `<filename>.<locale>.yaml` (e.g.
 * `01-atitus-ciencia-computacao.en.yaml`). `institution` stays canonical
 * (proper noun); `field` isn't rendered by `EducationItem` so it's excluded.
 */
const educationTranslations = defineCollection({
  loader: glob({
    base: './src/content/education',
    pattern: '*.*.yaml',
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: z.object({
    credential: z.string().optional(),
    description: z.string().optional(),
    highlights: z.array(z.string()).optional(),
  }),
});

const stack = defineCollection({
  loader: glob({ base: './src/content/stack', pattern: '**/*.yaml' }),
  schema: z.object({
    technologies: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          category: z.enum(TECH_CATEGORIES),
          core: z.boolean().default(false),
          note: z.string().optional(),
        }),
      )
      .min(1),
  }),
});

export const collections = {
  profile,
  profileTranslations,
  projects,
  projectTranslations,
  projectBodyTranslations,
  experience,
  experienceTranslations,
  education,
  educationTranslations,
  stack,
};
