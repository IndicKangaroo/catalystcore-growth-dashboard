import { DATE_PRESETS, DATE_PRESET_LABELS } from '@growth/shared';
import type { DatePreset } from '@growth/shared';
import type { ReactNode } from 'react';
import { useFilters } from './useFilters';

function Segment({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="h-8 whitespace-nowrap rounded-[8px] px-2.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg aria-pressed:shadow-card"
    >
      {children}
    </button>
  );
}

/**
 * The quick date ranges and "Custom", as a segmented control. Picking "Custom" starts from the days
 * already on screen; the two dates are then edited in the filter row under the top bar.
 */
export function DateRangeControl() {
  const { filters, range, setFilters } = useFilters();
  const selected: DatePreset | 'custom' =
    filters.range.kind === 'custom' ? 'custom' : filters.range.preset;

  function pickPreset(preset: DatePreset) {
    setFilters({ ...filters, range: { kind: 'preset', preset } });
  }

  function pickCustom() {
    if (selected === 'custom') return;
    setFilters({ ...filters, range: { kind: 'custom', from: range.from, to: range.to } });
  }

  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex max-w-full items-center overflow-x-auto rounded-control border border-line bg-muted p-0.5"
    >
      {DATE_PRESETS.map((preset) => (
        <Segment key={preset} selected={selected === preset} onClick={() => pickPreset(preset)}>
          {DATE_PRESET_LABELS[preset]}
        </Segment>
      ))}
      <Segment selected={selected === 'custom'} onClick={pickCustom}>
        Custom
      </Segment>
    </div>
  );
}
