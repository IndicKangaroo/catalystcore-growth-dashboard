import { createAppSchema, updateAppSchema } from '@growth/shared';
import type { AppRecord, Role } from '@growth/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, stubApi } from '../../test/api';
import type { ApiReply } from '../../test/api';
import { makeApp, readyState, renderWithSession } from '../../test/helpers';
import AppsPage from './AppsPage';

// The real apiFetch runs against a fake API below; only the sign-in token is faked.
vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue('test-token') }));

/** Makes one kind of request fail the way the real API would. Clear a field to let it succeed. */
interface Failures {
  list?: ApiReply;
  create?: ApiReply;
  update?: ApiReply;
  remove?: ApiReply;
}

const REFUSED = 'The form sent something the API would refuse.';

/**
 * A fake apps API backed by a list in memory, so the screen can be exercised from the list to the
 * form and back. It checks what the form sends with the same schemas the real API uses, and answers
 * 400 when they refuse it. Returns the requests it received.
 */
function stubAppsApi(initial: AppRecord[], failures: Failures = {}) {
  let apps = [...initial];
  const idOf = (path: string) => decodeURIComponent(path.slice('/api/apps/'.length));

  return stubApi({
    '/api/apps': () => failures.list ?? { body: { apps } },

    'POST /api/apps': ({ body }) => {
      if (failures.create) return failures.create;
      const parsed = createAppSchema.safeParse(body);
      if (!parsed.success) return apiError(400, 'validation_error', REFUSED);
      const created = makeApp({ ...parsed.data, id: `new${apps.length + 1}` });
      apps = [...apps, created];
      return { status: 201, body: { app: created } };
    },

    'PATCH /api/apps/*': ({ path, body }) => {
      if (failures.update) return failures.update;
      const parsed = updateAppSchema.safeParse(body);
      if (!parsed.success) return apiError(400, 'validation_error', REFUSED);
      const id = idOf(path);
      apps = apps.map((app) => (app.id === id ? { ...app, ...parsed.data } : app));
      return { body: { app: apps.find((app) => app.id === id) } };
    },

    'DELETE /api/apps/*': ({ path }) => {
      if (failures.remove) return failures.remove;
      const id = idOf(path);
      apps = apps.filter((app) => app.id !== id);
      return { status: 204 };
    },
  });
}

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.example.alpha';

const ALPHA = makeApp({
  id: 'a1',
  name: 'Alpha',
  packageName: 'com.example.alpha',
  status: 'production',
  ga4PropertyId: '123456789',
  launchDate: '2026-03-04',
  currentVersion: '1.2.0',
  category: 'Games',
  playStoreUrl: PLAY_URL,
});

const BETA = makeApp({ id: 'b2', name: 'Beta', packageName: 'com.example.beta' });

function renderApps(role: Role = 'admin') {
  return renderWithSession(<AppsPage />, { state: readyState(role) });
}

const rowFor = (name: RegExp) => screen.findByRole('row', { name });

async function openAddForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add app' }));
  return within(screen.getByRole('form', { name: 'Add an app' }));
}

/** Types into the two required boxes of the form that is open. */
function fillNameAndPackage(name: string, packageName: string) {
  fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Package name (required)'), {
    target: { value: packageName },
  });
}

describe('AppsPage for an admin', () => {
  it('lists every app with what is stored about it', async () => {
    stubAppsApi([ALPHA, BETA]);
    renderApps();
    expect(screen.getByRole('status')).toHaveTextContent('Loading apps…');

    const alpha = within(await rowFor(/Alpha/));
    expect(alpha.getByText('com.example.alpha')).toBeInTheDocument();
    expect(alpha.getByText('Production')).toBeInTheDocument();
    expect(alpha.getByText('GA4 property set')).toBeInTheDocument();
    expect(alpha.getByText('123456789')).toBeInTheDocument();
    expect(alpha.getByText('4 Mar 2026')).toBeInTheDocument();
    expect(alpha.getByText('1.2.0')).toBeInTheDocument();
    expect(alpha.getByText('Games')).toBeInTheDocument();
    expect(alpha.getByRole('link', { name: 'Open Alpha on Google Play' })).toHaveAttribute(
      'href',
      PLAY_URL,
    );

    // An app with nothing stored says so in words; it is never shown as a zero or left blank.
    const beta = within(screen.getByRole('row', { name: /Beta/ }));
    expect(beta.getByText('Development')).toBeInTheDocument();
    expect(beta.getByText('Not connected')).toBeInTheDocument();
    expect(beta.getByText('Not set')).toBeInTheDocument();
    expect(beta.queryByRole('link', { name: /Google Play/ })).not.toBeInTheDocument();
  });

  it('summarises the list above the table', async () => {
    stubAppsApi([ALPHA, BETA]);
    renderApps();
    await rowFor(/Alpha/);

    const valueOf = (label: string) =>
      screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(valueOf('Apps')).toBe('2');
    expect(valueOf('In production')).toBe('1');
    expect(valueOf('GA4 property set')).toBe('1 of 2');
    expect(screen.getByRole('heading', { name: 'Apps' })).toBeInTheDocument();
  });

  it('invites an admin to add the first app when the list is empty', async () => {
    stubAppsApi([]);
    renderApps();

    expect(await screen.findByRole('heading', { name: 'No apps yet' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add the first app' }));

    expect(screen.getByRole('form', { name: 'Add an app' })).toBeInTheDocument();
  });

  it('says when the list did not load, and loads it on Try again', async () => {
    const failures: Failures = {
      list: apiError(500, 'internal_error', 'Could not load the apps.'),
    };
    stubAppsApi([ALPHA], failures);
    renderApps();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the apps.');

    failures.list = undefined;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await rowFor(/Alpha/)).toBeInTheDocument();
  });

  describe('adding an app', () => {
    it('checks the form with the API rules before it sends anything', async () => {
      const requests = stubAppsApi([ALPHA]);
      renderApps();
      const form = await openAddForm();

      fireEvent.click(form.getByRole('button', { name: 'Add app' }));

      expect(form.getByText('Enter a name')).toBeInTheDocument();
      expect(form.getByText('Enter the package name')).toBeInTheDocument();
      expect(form.getByRole('alert')).toHaveTextContent(
        'Fix the fields marked above, then save again.',
      );
      expect(form.getByLabelText('Name (required)')).toBeInvalid();
      expect(form.getByLabelText('Package name (required)')).toBeInvalid();
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
    });

    it('says what is wrong with a package name written the wrong way', async () => {
      stubAppsApi([ALPHA]);
      renderApps();
      const form = await openAddForm();

      fillNameAndPackage('Gamma', 'gamma');
      fireEvent.click(form.getByRole('button', { name: 'Add app' }));

      expect(
        form.getByText('Use the package name, written like com.example.myapp'),
      ).toBeInTheDocument();
    });

    it('sends the cleaned-up values and shows the new app in the list', async () => {
      const requests = stubAppsApi([ALPHA]);
      renderApps();
      const form = await openAddForm();

      fillNameAndPackage('  Gamma ', 'com.example.gamma');
      fireEvent.change(form.getByLabelText('Status'), { target: { value: 'testing' } });
      fireEvent.change(form.getByLabelText('GA4 property ID'), {
        target: { value: 'properties/987654321' },
      });
      fireEvent.click(form.getByRole('button', { name: 'Add app' }));

      expect(await rowFor(/Gamma/)).toBeInTheDocument();
      expect(requests).toContainEqual({
        method: 'POST',
        path: '/api/apps',
        body: {
          name: 'Gamma',
          packageName: 'com.example.gamma',
          status: 'testing',
          iconUrl: null,
          ga4PropertyId: '987654321',
          firebaseProjectId: null,
          playStoreUrl: null,
          launchDate: null,
          category: null,
          currentVersion: null,
        },
      });
      await waitFor(() =>
        expect(screen.queryByRole('form', { name: 'Add an app' })).not.toBeInTheDocument(),
      );
    });

    it("keeps the form open and shows the server's reason when the app is refused", async () => {
      stubAppsApi([ALPHA], {
        create: apiError(
          409,
          'package_name_taken',
          'An app with this package name already exists.',
        ),
      });
      renderApps();
      const form = await openAddForm();

      fillNameAndPackage('Gamma', 'com.example.alpha');
      fireEvent.click(form.getByRole('button', { name: 'Add app' }));

      expect(await form.findByRole('alert')).toHaveTextContent(
        'An app with this package name already exists.',
      );
      expect(form.getByLabelText('Name (required)')).toHaveValue('Gamma');
      expect(screen.queryByRole('row', { name: /Gamma/ })).not.toBeInTheDocument();
    });

    it('closes the form on Cancel without sending anything', async () => {
      const requests = stubAppsApi([ALPHA]);
      renderApps();
      const form = await openAddForm();

      fireEvent.click(form.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('form', { name: 'Add an app' })).not.toBeInTheDocument();
      expect(requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
    });
  });

  describe('editing an app', () => {
    it('fills the form from the app, and an emptied optional box clears the stored value', async () => {
      const requests = stubAppsApi([ALPHA, BETA]);
      renderApps();

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Alpha' }));
      const form = within(screen.getByRole('form', { name: 'Edit Alpha' }));

      expect(form.getByLabelText('Name (required)')).toHaveValue('Alpha');
      expect(form.getByLabelText('Package name (required)')).toHaveValue('com.example.alpha');
      expect(form.getByLabelText('Status')).toHaveValue('production');
      expect(form.getByLabelText('GA4 property ID')).toHaveValue('123456789');
      expect(form.getByLabelText('Launch date')).toHaveValue('2026-03-04');

      fireEvent.change(form.getByLabelText('Name (required)'), { target: { value: 'Alpha Pro' } });
      fireEvent.change(form.getByLabelText('GA4 property ID'), { target: { value: '' } });
      fireEvent.click(form.getByRole('button', { name: 'Save changes' }));

      const row = within(await rowFor(/Alpha Pro/));
      expect(row.getByText('Not connected')).toBeInTheDocument();
      const patch = requests.find((request) => request.method === 'PATCH');
      expect(patch?.path).toBe('/api/apps/a1');
      expect(patch?.body).toMatchObject({
        name: 'Alpha Pro',
        packageName: 'com.example.alpha',
        ga4PropertyId: null,
      });
      await waitFor(() =>
        expect(screen.queryByRole('form', { name: 'Edit Alpha' })).not.toBeInTheDocument(),
      );
    });

    it("shows the server's reason when a change is refused, and keeps what was typed", async () => {
      stubAppsApi([ALPHA, BETA], {
        update: apiError(404, 'app_not_found', 'That app no longer exists.'),
      });
      renderApps();

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Alpha' }));
      const form = within(screen.getByRole('form', { name: 'Edit Alpha' }));
      fireEvent.change(form.getByLabelText('Name (required)'), { target: { value: 'Alpha Pro' } });
      fireEvent.click(form.getByRole('button', { name: 'Save changes' }));

      expect(await form.findByRole('alert')).toHaveTextContent('That app no longer exists.');
      expect(form.getByLabelText('Name (required)')).toHaveValue('Alpha Pro');
    });

    it('switches the form to another app without carrying the first one over', async () => {
      stubAppsApi([ALPHA, BETA]);
      renderApps();

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Alpha' }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit Beta' }));

      const form = within(screen.getByRole('form', { name: 'Edit Beta' }));
      expect(form.getByLabelText('Name (required)')).toHaveValue('Beta');
      expect(form.getByLabelText('GA4 property ID')).toHaveValue('');
    });
  });

  describe('deleting an app', () => {
    it('asks first, and deletes only after the admin confirms', async () => {
      const requests = stubAppsApi([ALPHA, BETA]);
      renderApps();

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Alpha' }));
      expect(screen.getByText('Delete this app?')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel deleting Alpha' }));
      expect(screen.queryByText('Delete this app?')).not.toBeInTheDocument();
      expect(requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Alpha' }));

      await waitFor(() =>
        expect(screen.queryByRole('row', { name: /Alpha/ })).not.toBeInTheDocument(),
      );
      expect(requests).toContainEqual({ method: 'DELETE', path: '/api/apps/a1', body: undefined });
      expect(screen.getByRole('row', { name: /Beta/ })).toBeInTheDocument();
    });

    it("shows the server's reason when a delete is refused, and keeps the app", async () => {
      stubAppsApi([ALPHA], {
        remove: apiError(409, 'app_in_use', 'Alpha still has campaigns, so it cannot be deleted.'),
      });
      renderApps();

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Alpha' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Alpha' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Alpha still has campaigns, so it cannot be deleted.',
      );
      expect(screen.getByRole('row', { name: /Alpha/ })).toBeInTheDocument();
    });
  });
});

describe('AppsPage for people who cannot change apps', () => {
  it.each(['growth', 'developer'] as const)(
    'shows the %s role the list, with no way to change it',
    async (role) => {
      stubAppsApi([ALPHA]);
      renderApps(role);

      expect(await rowFor(/Alpha/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add app' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit Alpha' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Alpha' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    },
  );

  it('tells them an admin has to add the first app', async () => {
    stubAppsApi([]);
    renderApps('growth');

    expect(
      await screen.findByText('An admin has to add the apps this studio tracks.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add the first app' })).not.toBeInTheDocument();
  });
});
