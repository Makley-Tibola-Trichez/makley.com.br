import type { CollectionEntry } from 'astro:content';

import { Education } from '@domain/education/education.entity';

export function toEducation(id: string, data: CollectionEntry<'education'>['data']): Education {
  return Education.create({
    id: id.replace(/^\d+-/, ''),
    institution: data.institution,
    credential: data.credential,
    kind: data.kind,
    start: data.start,
    // A credential without an explicit end is a point in time, not an ongoing
    // period — collapsing it here keeps `Education.isPointInTime` honest.
    // `inProgress` opts a genuinely ongoing entry (e.g. a running
    // postgraduate program) out of that collapse.
    end: data.end ?? (data.inProgress ? null : data.start),
    field: data.field,
    description: data.description,
    highlights: data.highlights,
    credentialUrl: data.credentialUrl,
  });
}
