import type { AppRecord, DatePreset } from '@growth/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Link, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FilterScope } from '../../components/navigation';
import { stubApi } from '../../test/api';
import { makeApp, makeStudio, readyState, renderWithSession } from '../../test/helpers';
import { useApps } from '../apps/queries';
import { DateRangeControl } from './DateRangeControl';
import { FilterRow } from './FilterRow';

// The app chips read the list through the real apiFetch; only the sign-in token is faked.
vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

/** Shows the part of the address after "?", which is where the filters live. */
function AddressProbe() {
  const { search } = useLocation();
  return <p data-testid="address">{search}</p>;
}

/** Says when the app list has arrived, so a test can tell "no chips" from "not loaded yet". */
function AppsLoadedProbe() {
  const apps = useApps();
  return <p>{apps.data ? `Apps loaded: ${apps.data.length}` : 'Apps loading'}</p>;
}

function Harness({ scope }: { scope: FilterScope }) {
  return (
    <>
      <DateRangeControl />
      <FilterRow scope={scope} />
      <AddressProbe />
      <AppsLoadedProbe />
      <Link to="/?range=custom&from=2026-10-02&to=2026-10-04">Jump to another range</Link>
    </>
  );
}

interface Options {
  route?: string;
  scope?: FilterScope;
  apps?: AppRecord[];
  defaultDateRange?: DatePreset;
}

function renderFilters({
  route = '/',
  scope = 'range-and-apps',
  apps = [],
  defaultDateRange = '30d',
}: Options = {}) {
  stubApi({ '/api/apps': { body: { apps } } });
  return renderWithSession(<Harness scope={scope} />, {
    state: readyState(),
    route,
    studio: makeStudio({ defaultDateRange }),
  });
}

const address = () => screen.getByTestId('address').textContent;
const range = (name: string) => screen.getByRole('button', { name });

const ALPHA = makeApp({ id: 'a1', name: 'Alpha' });
const BETA = makeApp({ id: 'b2', name: 'Beta' });

describe('date range control', () => {
  it("marks the studio's usual range as chosen when the address names none", () => {
    renderFilters({ defaultDateRange: '90d' });

    expect(range('Last 90 days')).toHaveAttribute('aria-pressed', 'true');
    expect(range('Last 30 days')).toHaveAttribute('aria-pressed', 'false');
    expect(range('Custom')).toHaveAttribute('aria-pressed', 'false');
    expect(address()).toBe('');
  });

  it('reads the range from the address', () => {
    renderFilters({ route: '/?range=today' });

    expect(range('Today')).toHaveAttribute('aria-pressed', 'true');
    expect(range('Last 30 days')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the usual range when the address names one that does not exist', () => {
    renderFilters({ route: '/?range=forever' });

    expect(range('Last 30 days')).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts a picked range in the address, and leaves the usual range out of it', () => {
    renderFilters();

    fireEvent.click(range('Last 7 days'));
    expect(address()).toBe('?range=7d');
    expect(range('Last 7 days')).toHaveAttribute('aria-pressed', 'true');
    expect(range('Last 30 days')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(range('Last 30 days'));
    expect(address()).toBe('');
  });

  it('keeps address parameters that are not filters', () => {
    renderFilters({ route: '/?page=2' });

    fireEvent.click(range('Last 7 days'));

    expect(address()).toBe('?page=2&range=7d');
  });

  it('starts a custom range from the days already on screen, in the studio time zone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T06:00:00Z'));
    renderFilters();

    fireEvent.click(range('Custom'));

    expect(address()).toBe('?range=custom&from=2026-09-16&to=2026-10-15');
    expect(range('Custom')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('From')).toHaveValue('2026-09-16');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-15');
  });

  it('shows the usual range for a custom range that makes no sense', () => {
    renderFilters({ route: '/?range=custom&from=2026-10-20&to=2026-10-01' });

    expect(range('Last 30 days')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: 'Custom date range' })).not.toBeInTheDocument();
  });

  it('drops the custom dates, and keeps the apps, when a quick range is picked', async () => {
    renderFilters({
      route: '/?range=custom&from=2026-10-01&to=2026-10-15&appIds=a1',
      apps: [ALPHA],
    });
    expect(screen.getByRole('group', { name: 'Custom date range' })).toBeInTheDocument();

    fireEvent.click(range('Last 7 days'));

    expect(address()).toBe('?range=7d&appIds=a1');
    expect(screen.queryByRole('group', { name: 'Custom date range' })).not.toBeInTheDocument();
    // Wait for the app list too, so the test ends with nothing still in flight.
    expect(await screen.findByText('Apps loaded: 1')).toBeInTheDocument();
  });
});

describe('custom dates', () => {
  const customSearch = '?range=custom&from=2026-10-01&to=2026-10-15';
  const customRoute = `/${customSearch}`;

  it('puts each edited date in the address', () => {
    renderFilters({ route: customRoute });

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } });
    expect(address()).toBe('?range=custom&from=2026-10-05&to=2026-10-15');

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-12' } });
    expect(address()).toBe('?range=custom&from=2026-10-05&to=2026-10-12');
  });

  it('says what is wrong with a range, and leaves the address alone until it is fine', () => {
    renderFilters({ route: customRoute });
    const from = screen.getByLabelText('From');

    fireEvent.change(from, { target: { value: '2026-10-20' } });
    expect(screen.getByText('The start date is after the end date')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInvalid();
    expect(address()).toBe(customSearch);

    fireEvent.change(from, { target: { value: '2025-01-01' } });
    expect(screen.getByText('Choose at most 366 days')).toBeInTheDocument();
    expect(address()).toBe(customSearch);

    fireEvent.change(from, { target: { value: '2026-10-10' } });
    expect(screen.queryByText('Choose at most 366 days')).not.toBeInTheDocument();
    expect(screen.getByLabelText('To')).not.toBeInvalid();
    expect(address()).toBe('?range=custom&from=2026-10-10&to=2026-10-15');
  });

  it('shows the dates the address holds when it changes under the boxes', () => {
    renderFilters({ route: customRoute });

    fireEvent.click(screen.getByRole('link', { name: 'Jump to another range' }));

    expect(screen.getByLabelText('From')).toHaveValue('2026-10-02');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-04');
  });

  it('appears only on screens that use the date range', () => {
    renderFilters({ route: customRoute, scope: 'none' });

    expect(screen.queryByRole('group', { name: 'Custom date range' })).not.toBeInTheDocument();
  });
});

describe('app filter', () => {
  it('offers a chip per app and narrows the screen to the apps picked', async () => {
    renderFilters({ apps: [ALPHA, BETA] });
    const chips = within(await screen.findByRole('group', { name: 'Apps' }));
    const chip = (name: string) => chips.getByRole('button', { name });

    expect(chip('All apps')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Alpha')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chip('Alpha'));
    expect(address()).toBe('?appIds=a1');
    expect(chip('Alpha')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('All apps')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chip('Beta'));
    expect(address()).toBe('?appIds=a1%2Cb2');

    fireEvent.click(chip('Alpha'));
    expect(address()).toBe('?appIds=b2');

    fireEvent.click(chip('All apps'));
    expect(address()).toBe('');
    expect(chip('All apps')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the chosen range when apps are picked', async () => {
    renderFilters({ route: '/?range=7d', apps: [ALPHA] });

    fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }));

    expect(address()).toBe('?range=7d&appIds=a1');
  });

  it('drops an app the list does not know, such as one that was deleted', async () => {
    renderFilters({ route: '/?appIds=gone%2Ca1', apps: [ALPHA] });

    await waitFor(() => expect(address()).toBe('?appIds=a1'));
  });

  it('drops every chosen app once no app is left', async () => {
    renderFilters({ route: '/?range=7d&appIds=gone', apps: [] });

    await waitFor(() => expect(address()).toBe('?range=7d'));
  });

  it('offers no chips while no app exists', async () => {
    renderFilters({ apps: [] });

    expect(await screen.findByText('Apps loaded: 0')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Apps' })).not.toBeInTheDocument();
  });

  it('offers no chips on a screen that does not filter by app', async () => {
    renderFilters({ scope: 'range', apps: [ALPHA] });

    expect(await screen.findByText('Apps loaded: 1')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Apps' })).not.toBeInTheDocument();
  });
});
