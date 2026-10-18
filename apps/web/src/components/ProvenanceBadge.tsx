import { PROVENANCE_LABELS } from '@growth/shared';
import type { Provenance } from '@growth/shared';
import { Icon } from './Icon';

// What each kind of number is, in words, for the tooltip (D-002). The badge itself never relies on
// colour: measured is filled with a check, inferred has a dashed outline and a "~", manual is
// plain with a pencil, and every one of them also spells its name.
const MEANINGS: Record<Provenance, string> = {
  measured: 'Measured: matched to a registered campaign by its tracking parameters.',
  inferred: 'Inferred: estimated, not confirmed attribution.',
  manual: 'Manual: entered by a person, not measured.',
};

const STYLES: Record<Provenance, string> = {
  measured: 'border-transparent bg-accent text-accent-fg',
  inferred: 'border-dashed border-line-strong bg-transparent text-fg-muted',
  manual: 'border-line bg-muted text-fg-muted',
};

/** How an attribution number was obtained. Every component that shows attribution uses this. */
export function ProvenanceBadge({
  provenance,
  className = '',
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      title={MEANINGS[provenance]}
      className={`inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-chip border px-2 text-[11px] font-medium ${STYLES[provenance]} ${className}`}
    >
      {provenance === 'measured' && <Icon name="check" />}
      {provenance === 'inferred' && <span aria-hidden="true">~</span>}
      {provenance === 'manual' && <Icon name="pencil" />}
      {PROVENANCE_LABELS[provenance]}
    </span>
  );
}
