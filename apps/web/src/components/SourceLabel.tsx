import { ANALYTICS_PROVIDER_LABELS } from '@growth/shared';
import type { AnalyticsProviderName } from '@growth/shared';
import { Chip } from './Chip';
import { Icon } from './Icon';

/**
 * Says where the numbers on a screen came from, read from the answer's own `source`, so a screen
 * can never show demo numbers without saying so (D-003, D-036).
 */
export function SourceLabel({ source }: { source: AnalyticsProviderName }) {
  const label = ANALYTICS_PROVIDER_LABELS[source];

  if (source === 'seed') {
    return (
      <Chip
        tone="warn"
        title="The numbers on this screen are generated sample data, not real analytics."
      >
        <Icon name="database" />
        {label}
      </Chip>
    );
  }
  return <Chip title="Where the numbers on this screen come from.">{label}</Chip>;
}
