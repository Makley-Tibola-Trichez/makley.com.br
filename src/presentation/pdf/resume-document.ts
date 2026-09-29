/**
 * Builds the downloadable résumé PDF from the same domain entities that render
 * the online `/curriculo` page — Profile, Experience, Education, TechStack.
 *
 * Why generate it instead of hosting a manually uploaded file
 * -------------------------------------------------------------
 * The résumé content lives in `src/content/**`, validated at build time. A
 * manually maintained PDF is a *second* source of truth that silently drifts
 * from the site the moment either one is edited — the online résumé updates
 * immediately, the PDF only when someone remembers to re-export and re-upload
 * it. Generating the PDF from the same entities at build time makes drift
 * structurally impossible: there is exactly one place the content lives.
 *
 * Why this "caches" without any server or TTL
 * -------------------------------------------------------------
 * The site is fully static (`output: 'static'`): content only changes when a
 * new deploy runs. Generating the PDF as a build-time route means the file is
 * produced once per deploy and then served by the CDN exactly like any other
 * static asset — indefinitely, until the next deploy replaces it. That is the
 * same effective behaviour as a time-based cache, without a serverless
 * function, without added latency per request, and without paying to run
 * `@react-pdf/renderer` on every visit.
 *
 * Why no JSX
 * -------------------------------------------------------------
 * This project deliberately ships zero UI framework runtime to the browser.
 * Using `.tsx` here would require wiring a JSX pragma into Vite/Astro for a
 * dependency that only ever runs at build time — for one file, that is more
 * configuration than it is worth. `React.createElement` calls do exactly the
 * same thing as JSX without touching the build pipeline.
 *
 * Why Helvetica (react-pdf's built-in font)
 * -------------------------------------------------------------
 * The site's self-hosted Geist/Instrument Serif subsets are woff2-only. PDF
 * embedding wants ttf/otf, and registering a font that fails to embed produces
 * silent tofu glyphs in the exported file — a much worse failure mode than
 * using a built-in PDF-safe font, which is guaranteed to render correctly in
 * every viewer with the full Latin-1/WinAnsi accent range Portuguese needs.
 *
 * Why every atomic block is a single stacked `Text`, never a `flexDirection:
 * 'row'` View with multiple children
 * -------------------------------------------------------------------------
 * Verified empirically (see the throwaway reproduction that led to this
 * comment): when a two-column row — e.g. role/company on the left, period/
 * location on the right — falls near a page boundary, `@react-pdf/renderer`'s
 * pagination does not always move the row as one unit. It can paginate each
 * column independently, or even split a single column's own two lines apart,
 * scattering "role" onto one page and "company" onto the next. Neither
 * `wrap={false}` nor `minPresenceAhead` on the row reliably prevented this in
 * testing. A single `Text` node with `wrap={false}` on its containing `View`
 * does not have this failure mode — there is only one node for the pagination
 * algorithm to place, not several that can drift apart — so every entry header
 * and every bullet here is one line of text, not a row of cells.
 */
import { createElement as h } from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { Education } from '@domain/education/education.entity';
import type { Experience } from '@domain/experience/experience.entity';
import type { Profile } from '@domain/profile/profile.entity';
import type { TechnologyGroup } from '@domain/tech-stack/technology.entity';
import { getTechCategoryLabel, getTechName } from '@i18n/dictionaries/stack';
import type { Locale } from '@i18n/locales';

export interface ResumeData {
  readonly profile: Profile;
  readonly experiences: readonly Experience[];
  readonly education: readonly Education[];
  readonly techGroups: readonly TechnologyGroup[];
  readonly locale: Locale;
}

/**
 * Self-contained pt-BR/en text for this document — kept local rather than
 * added to `resumePageDictionary` because a couple of labels intentionally
 * differ from the web page's own wording (e.g. the shorter "Certificações e
 * cursos" here vs. "Certificações, cursos e eventos" on `/curriculo`, which
 * predates this file and isn't this change's concern to reconcile).
 */
const PDF_TEXT: Record<
  Locale,
  {
    documentTitlePrefix: string;
    summaryHeading: string;
    experienceHeading: string;
    educationHeading: string;
    credentialsHeading: string;
    stackHeading: string;
    languagesHeading: string;
    technologiesLabel: string;
    resultsLabel: string;
    presentLabel: string;
    footer: (firstName: string, page: number, total: number) => string;
  }
> = {
  'pt-BR': {
    documentTitlePrefix: 'Currículo',
    summaryHeading: 'Resumo profissional',
    experienceHeading: 'Experiência profissional',
    educationHeading: 'Formação acadêmica',
    credentialsHeading: 'Certificações e cursos',
    stackHeading: 'Stack tecnológica',
    languagesHeading: 'Idiomas',
    technologiesLabel: 'Tecnologias: ',
    resultsLabel: 'Resultados: ',
    presentLabel: 'atual',
    footer: (firstName, page, total) =>
      `Gerado a partir de ${firstName}.com.br · página ${page} de ${total}`,
  },
  en: {
    documentTitlePrefix: 'Resume',
    summaryHeading: 'Professional summary',
    experienceHeading: 'Professional experience',
    educationHeading: 'Education',
    credentialsHeading: 'Certifications & courses',
    stackHeading: 'Tech stack',
    languagesHeading: 'Languages',
    technologiesLabel: 'Technologies: ',
    resultsLabel: 'Results: ',
    presentLabel: 'present',
    footer: (firstName, page, total) =>
      `Generated from ${firstName}.com.br · page ${page} of ${total}`,
  },
};

const COLOR = {
  ink: '#16181a',
  muted: '#4a4f56',
  faint: '#767c86',
  accent: '#b03a10',
  line: '#d8dade',
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: COLOR.ink,
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.ink,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 21,
    letterSpacing: -0.3,
  },
  role: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COLOR.accent,
    marginTop: 2,
    marginBottom: 6,
  },
  /**
   * Contact items are joined into one Text with `·` separators instead of a
   * flex row of chips — one node, not several, near the very top of page 1
   * where pagination is not a concern anyway, but kept consistent with the
   * rest of the document's "no multi-child rows" rule.
   */
  contactLine: {
    fontSize: 8.5,
    color: COLOR.muted,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLOR.accent,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.line,
  },
  summary: {
    fontSize: 9.5,
    color: COLOR.muted,
  },
  specialtiesLine: {
    fontSize: 8,
    color: COLOR.muted,
    marginTop: 5,
  },
  entry: {
    marginBottom: 9,
  },
  entryTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  entryMeta: {
    fontSize: 8,
    color: COLOR.faint,
    marginTop: 1,
  },
  entrySummary: {
    fontSize: 9,
    color: COLOR.muted,
    marginTop: 3,
  },
  bulletText: {
    fontSize: 8.75,
    color: COLOR.muted,
    marginTop: 1.5,
  },
  metaLine: {
    fontSize: 8,
    color: COLOR.faint,
    marginTop: 3,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: COLOR.muted,
  },
  stackGroup: {
    marginBottom: 5,
  },
  stackGroupLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    marginBottom: 2,
  },
  stackGroupItems: {
    fontSize: 8.5,
    color: COLOR.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    fontSize: 7,
    color: COLOR.faint,
    textAlign: 'center',
  },
});

/** `nov 2021 — present` using the same locale rules as the web page. */
function periodLabel(
  period: { toLabel(locale?: string, present?: string): string },
  locale: Locale,
): string {
  return period.toLabel(locale, PDF_TEXT[locale].presentLabel);
}

/** Every bullet is its own single-line `Text` — see the file header for why. */
function buildBullets(items: readonly string[]) {
  return items.map((item, index) => h(Text, { key: index, style: styles.bulletText }, `•  ${item}`));
}

function buildExperienceEntry(experience: Experience, locale: Locale) {
  const text = PDF_TEXT[locale];

  const techLine =
    experience.technologies.length > 0
      ? h(
          Text,
          { style: styles.metaLine },
          h(Text, { style: styles.metaLabel }, text.technologiesLabel),
          experience.technologies.join(', '),
        )
      : null;

  const achievementsLine =
    experience.achievements.length > 0
      ? h(
          Text,
          { style: styles.metaLine },
          h(Text, { style: styles.metaLabel }, text.resultsLabel),
          experience.achievements.map((a) => `${a.label} — ${a.value}`).join(' · '),
        )
      : null;

  return h(
    View,
    { style: styles.entry, wrap: false },
    h(Text, { style: styles.entryTitle }, experience.fullRole),
    h(
      Text,
      { style: styles.entryMeta },
      `${experience.company}  ·  ${periodLabel(experience.period, locale)}  ·  ${experience.location}`,
    ),
    h(Text, { style: styles.entrySummary }, experience.summary),
    ...buildBullets(experience.responsibilities),
    achievementsLine,
    techLine,
  );
}

function buildEducationEntry(item: Education) {
  return h(
    View,
    { style: styles.entry, wrap: false },
    h(Text, { style: styles.entryTitle }, item.credential),
    h(Text, { style: styles.entryMeta }, `${item.institution}  ·  ${item.periodLabel}`),
    item.description ? h(Text, { style: styles.entrySummary }, item.description) : null,
    ...(item.highlights.length > 0 ? buildBullets(item.highlights) : []),
  );
}

function buildCredentialLine(item: Education) {
  return h(
    Text,
    { style: styles.metaLine },
    h(Text, { style: styles.metaLabel }, `${item.credential} `),
    `— ${item.institution} · ${item.periodLabel}`,
  );
}

function buildStackGroup(group: TechnologyGroup, locale: Locale) {
  return h(
    View,
    { style: styles.stackGroup, wrap: false },
    h(Text, { style: styles.stackGroupLabel }, getTechCategoryLabel(group.category, locale, group.label)),
    h(
      Text,
      { style: styles.stackGroupItems },
      group.technologies.map((t) => getTechName(t.id.value, locale, t.name)).join(' · '),
    ),
  );
}

/**
 * Assembles the résumé as a `@react-pdf/renderer` element tree.
 * Pass the result to `renderToBuffer` from the calling Astro route.
 */
export function buildResumeDocument(data: ResumeData) {
  const { profile, experiences, education, techGroups, locale } = data;
  const text = PDF_TEXT[locale];

  const degree = education.filter((item) => item.kind === 'graduacao' || item.kind === 'pos-graduacao');
  const credentials = education.filter((item) => item.kind !== 'graduacao' && item.kind !== 'pos-graduacao');

  const contactParts: string[] = [profile.email, profile.location];
  const linkedin = profile.social('linkedin');
  const github = profile.social('github');
  if (linkedin) contactParts.push(`linkedin.com/in/${linkedin.handle}`);
  if (github) contactParts.push(`github.com/${github.handle}`);

  return h(
    Document,
    {
      title: `${text.documentTitlePrefix} — ${profile.name}`,
      author: profile.name,
      language: locale === 'en' ? 'en-US' : 'pt-BR',
    },
    h(
      Page,
      { size: 'A4', style: styles.page },

      // ------------------------------------------------------------- header
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.name }, profile.name),
        h(Text, { style: styles.role }, profile.title),
        h(Text, { style: styles.contactLine }, contactParts.join('   ·   ')),
      ),

      // ------------------------------------------------------------- summary
      h(
        View,
        { style: styles.section },
        h(Text, { style: styles.sectionTitle }, text.summaryHeading),
        h(Text, { style: styles.summary }, profile.heroIntro),
        h(Text, { style: styles.specialtiesLine }, profile.specialties.join('   ·   ')),
      ),

      // --------------------------------------------------------- experience
      h(
        View,
        { style: styles.section },
        h(Text, { style: styles.sectionTitle }, text.experienceHeading),
        ...experiences.map((experience) => buildExperienceEntry(experience, locale)),
      ),

      // ----------------------------------------------------------- education
      degree.length > 0
        ? h(
            View,
            { style: styles.section },
            h(Text, { style: styles.sectionTitle }, text.educationHeading),
            ...degree.map((item) => buildEducationEntry(item)),
          )
        : null,

      // ------------------------------------------------------- credentials
      credentials.length > 0
        ? h(
            View,
            { style: styles.section },
            h(Text, { style: styles.sectionTitle }, text.credentialsHeading),
            ...credentials.map((item) => buildCredentialLine(item)),
          )
        : null,

      // ------------------------------------------------------------- stack
      h(
        View,
        { style: styles.section },
        h(Text, { style: styles.sectionTitle }, text.stackHeading),
        ...techGroups.map((group) => buildStackGroup(group, locale)),
      ),

      // ---------------------------------------------------------- languages
      h(
        View,
        { style: styles.section },
        h(Text, { style: styles.sectionTitle }, text.languagesHeading),
        ...profile.languages.map((language, index) =>
          h(
            Text,
            { key: index, style: styles.metaLine },
            h(Text, { style: styles.metaLabel }, `${language.name}: `),
            language.level,
          ),
        ),
      ),

      h(Text, {
        style: styles.footer,
        fixed: true,
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          text.footer(profile.name.split(' ')[0]?.toLowerCase() ?? '', pageNumber, totalPages),
      }),
    ),
  );
}
