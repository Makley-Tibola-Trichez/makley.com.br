import type { Locale } from '../locales';
import type { Education, EducationKind } from '@domain/education/education.entity';

export interface EducationDictionary {
  eyebrow: string;
  title: string;
  description: string;
  secondaryTitle: string;
  opensInNewTab: string;
}

export const educationDictionary: Record<Locale, EducationDictionary> = {
  'pt-BR': {
    eyebrow: 'Formação',
    title: 'Base acadêmica e aprendizado contínuo',
    description: 'Bacharelado em Ciência da Computação, pesquisa aplicada e certificações técnicas.',
    secondaryTitle: 'Certificações, cursos e eventos',
    opensInNewTab: '(abre em nova aba)',
  },
  en: {
    eyebrow: 'Education',
    title: 'Academic background and continuous learning',
    description: 'Computer Science degree, applied research and technical certifications.',
    secondaryTitle: 'Certifications, courses and events',
    opensInNewTab: '(opens in a new tab)',
  },
};

/**
 * `Education.kindLabel` is hardcoded pt-BR in the domain layer
 * (EDUCATION_KIND_LABELS in education.entity.ts). Additive, locale-aware
 * lookup, same pattern as the tech/project category label helpers.
 */
const EDUCATION_KIND_LABELS_EN: Record<EducationKind, string> = {
  graduacao: 'Degree',
  'pos-graduacao': 'Postgraduate',
  certificacao: 'Certification',
  curso: 'Course',
  evento: 'Event',
  publicacao: 'Publication',
};

export function getEducationKindLabel(kind: EducationKind, locale: Locale, fallback: string): string {
  return locale === 'en' ? EDUCATION_KIND_LABELS_EN[kind] : fallback;
}

/**
 * `Education.periodLabel` hardcodes `Intl.DateTimeFormat('pt-BR', ...)` for
 * point-in-time credentials and `'pt-BR'`/`'em andamento'` for ranges.
 * Additive, locale-aware equivalent built on the entity's public `period`
 * and `isPointInTime` — the entity getter itself stays untouched.
 */
const IN_PROGRESS_LABEL: Record<Locale, string> = {
  'pt-BR': 'em andamento',
  en: 'in progress',
};

export function formatEducationPeriodLabel(item: Education, locale: Locale): string {
  if (item.isPointInTime) {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(item.period.start)
      .replace('.', '');
  }
  return item.period.toLabel(locale, IN_PROGRESS_LABEL[locale]);
}
