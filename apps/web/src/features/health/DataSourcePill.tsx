import { ANALYTICS_PROVIDER_LABELS } from '@growth/shared';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { useHealth } from './useHealth';

/**
 * Says where the numbers on screen come from when that is not real analytics. The demo provider's
 * label is "Demo data" (D-003); nothing is shown for a real source or while the answer is unknown,
 * because a label would claim more than the dashboard knows.
 */
export function DataSourcePill() {
  const health = useHealth();
  if (health.data?.provider !== 'seed') return null;

  return (
    <Chip tone="warn" title="The numbers shown are generated sample data, not real analytics.">
      <Icon name="database" />
      {ANALYTICS_PROVIDER_LABELS.seed}
    </Chip>
  );
}
