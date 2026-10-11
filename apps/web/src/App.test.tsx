import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows the data source once the API responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', provider: 'seed' }),
      }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Growth Analytics' })).toBeInTheDocument();
    expect(await screen.findByText(/API connected \(data source: seed\)/)).toBeInTheDocument();
  });

  it('shows an error state when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<App />);

    expect(await screen.findByText(/API not reachable: network down/)).toBeInTheDocument();
  });
});
