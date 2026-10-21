import { PROVENANCE } from '@growth/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProvenanceBadge } from './ProvenanceBadge';

describe('ProvenanceBadge', () => {
  it.each(PROVENANCE)('spells out %s, so colour is never the only signal', (provenance) => {
    render(<ProvenanceBadge provenance={provenance} />);

    expect(screen.getByText(/^(Measured|Inferred|Manual)$/)).toBeInTheDocument();
  });

  it('names each kind and explains it in the tooltip', () => {
    const { rerender } = render(<ProvenanceBadge provenance="measured" />);
    expect(screen.getByText('Measured')).toHaveAttribute(
      'title',
      expect.stringContaining('registered campaign'),
    );

    rerender(<ProvenanceBadge provenance="inferred" />);
    expect(screen.getByText('Inferred')).toHaveAttribute(
      'title',
      expect.stringContaining('not confirmed attribution'),
    );

    rerender(<ProvenanceBadge provenance="manual" />);
    expect(screen.getByText('Manual')).toHaveAttribute(
      'title',
      expect.stringContaining('entered by a person'),
    );
  });

  it('gives each kind its own shape: a dashed outline marks an inferred number', () => {
    const { rerender } = render(<ProvenanceBadge provenance="inferred" />);
    expect(screen.getByText('Inferred').className).toContain('border-dashed');

    rerender(<ProvenanceBadge provenance="measured" />);
    expect(screen.getByText('Measured').className).not.toContain('border-dashed');
  });
});
