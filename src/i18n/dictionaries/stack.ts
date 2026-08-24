import type { Locale } from '../locales';
import type { TechCategory } from '@domain/tech-stack/technology.entity';

export interface StackDictionary {
  eyebrow: string;
  title: string;
  description: string;
  coreTitle: string;
}

export const stackDictionary: Record<Locale, StackDictionary> = {
  'pt-BR': {
    eyebrow: 'Stack',
    title: 'Ferramentas que uso para construir',
    description:
      'Destaque para o que uso no dia a dia em produção. O restante é apoio — tecnologias com que já entreguei ou mantive projetos.',
    coreTitle: 'Núcleo do dia a dia',
  },
  en: {
    eyebrow: 'Stack',
    title: 'Tools I use to build',
    description:
      "Highlighted: what I use day to day in production. The rest is supporting — technologies I've shipped or maintained projects with.",
    coreTitle: 'Daily-driver core',
  },
};

/**
 * `Technology.categoryLabel` and `TechnologyGroup.label` are hardcoded pt-BR
 * in the domain layer (see TECH_CATEGORY_LABELS in technology.entity.ts).
 * Rather than turning that getter into a locale-parameterised method — which
 * would ripple into every out-of-scope call site (résumé PDF, /curriculo,
 * structured data) — this is an additive, locale-aware lookup that only the
 * organisms being translated call directly.
 */
const TECH_CATEGORY_LABELS_EN: Record<TechCategory, string> = {
  frontend: 'Front-end',
  backend: 'Back-end',
  mobile: 'Mobile',
  database: 'Database',
  cloud: 'Cloud',
  devops: 'DevOps',
  testing: 'Testing & Quality',
  observability: 'Observability & Product',
  tooling: 'Tooling',
  ai: 'Artificial Intelligence',
};

export function getTechCategoryLabel(category: TechCategory, locale: Locale, fallback: string): string {
  return locale === 'en' ? TECH_CATEGORY_LABELS_EN[category] : fallback;
}

/**
 * Only the core (`core: true`) technologies with a `note` render it in the
 * UI — everything else falls through to the pt-BR note unchanged.
 */
const TECH_NOTES_EN: Partial<Record<string, string>> = {
  react: '5 years in production',
  typescript: 'Primary language',
  python: 'APIs and automation at Sicredi',
  playwright: 'RPA and test automation',
};

export function getTechNote(technologyId: string, locale: Locale, fallback: string | null): string | null {
  if (locale === 'en' && TECH_NOTES_EN[technologyId]) return TECH_NOTES_EN[technologyId] as string;
  return fallback;
}

/**
 * Almost every `technology.name` is a genuine proper noun (React, TypeScript,
 * Docker...) and needs no translation. These two are the exception — plain
 * pt-BR descriptive phrases standing in for a skill name — so this is a
 * narrow additive lookup rather than a change to the `stack` schema.
 */
const TECH_NAMES_EN: Partial<Record<string, string>> = {
  microsservicos: 'Microservices',
};

export function getTechName(technologyId: string, locale: Locale, fallback: string): string {
  if (locale === 'en' && TECH_NAMES_EN[technologyId]) return TECH_NAMES_EN[technologyId] as string;
  return fallback;
}
