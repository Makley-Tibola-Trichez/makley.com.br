import { DateRange, type YearMonth } from '../shared/value-objects/date-range.vo';
import { Slug } from '../shared/value-objects/slug.vo';

/**
 * The brief asks for "formação, cursos, certificações e eventos" in one
 * timeline. Modelling them as one entity with a `kind` discriminator — rather
 * than four near-identical entities — keeps the timeline component generic and
 * lets the UI filter by kind without any extra plumbing.
 */
export const EDUCATION_KINDS = [
  'graduacao',
  'pos-graduacao',
  'certificacao',
  'curso',
  'evento',
  'publicacao',
] as const;

export type EducationKind = (typeof EDUCATION_KINDS)[number];

export const EDUCATION_KIND_LABELS: Record<EducationKind, string> = {
  graduacao: 'Graduação',
  'pos-graduacao': 'Pós-graduação',
  certificacao: 'Certificação',
  curso: 'Curso',
  evento: 'Evento',
  publicacao: 'Publicação',
};

export interface EducationProps {
  readonly id: string;
  readonly institution: string;
  readonly credential: string;
  readonly kind: EducationKind;
  readonly start: YearMonth;
  readonly end?: YearMonth | null;
  readonly field?: string;
  readonly description?: string;
  readonly highlights?: readonly string[];
  readonly credentialUrl?: string;
  readonly inProgress?: boolean;
}

export class Education {
  private constructor(
    public readonly id: Slug,
    public readonly institution: string,
    public readonly credential: string,
    public readonly kind: EducationKind,
    public readonly period: DateRange,
    public readonly field: string | null,
    public readonly description: string | null,
    public readonly highlights: readonly string[],
    public readonly credentialUrl: string | null,
  ) {}

  static create(props: EducationProps): Education {
    return new Education(
      Slug.create(props.id),
      props.institution,
      props.credential,
      props.kind,
      DateRange.create(props.start, props.end ?? null),
      props.field ?? null,
      props.description ?? null,
      props.highlights ?? [],
      props.credentialUrl ?? null,
    );
  }

  get kindLabel(): string {
    return EDUCATION_KIND_LABELS[this.kind];
  }

  /**
   * Single-moment credentials (a certification, a talk) read as a point in
   * time, not a span — `mar 2022 — mar 2022` would be noise.
   */
  get isPointInTime(): boolean {
    return this.period.endISO === this.period.startISO;
  }

  get periodLabel(): string {
    if (this.isPointInTime) {
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
        .format(this.period.start)
        .replace('.', '');
    }
    return this.period.toLabel('pt-BR', 'em andamento');
  }

  static compareDesc(a: Education, b: Education): number {
    return DateRange.compareDesc(a.period, b.period);
  }
}
