import { describe, expect, it } from 'vitest';
import { appRecordSchema, createAppSchema, ga4PropertyIdSchema, updateAppSchema } from './apps';

const minimal = { name: 'Grind Quest', packageName: 'com.example.grindquest' };

function issuesOf(schema: { safeParse(value: unknown): unknown }, value: unknown): string {
  const result = schema.safeParse(value) as {
    success: boolean;
    error?: { issues: { path: (string | number)[]; message: string }[] };
  };
  if (result.success) return '';
  return (result.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

describe('createAppSchema', () => {
  it('needs only a name and a package name, and fills in the rest', () => {
    expect(createAppSchema.parse(minimal)).toEqual({
      name: 'Grind Quest',
      packageName: 'com.example.grindquest',
      status: 'development',
      iconUrl: null,
      ga4PropertyId: null,
      firebaseProjectId: null,
      playStoreUrl: null,
      launchDate: null,
      category: null,
      currentVersion: null,
    });
  });

  it('trims text and keeps what was given', () => {
    const app = createAppSchema.parse({
      name: '  PDF & Image Toolkit ',
      packageName: ' com.example.pdftoolkit ',
      status: 'production',
      iconUrl: ' https://example.com/icon.png ',
      ga4PropertyId: '123456789',
      firebaseProjectId: 'pdf-toolkit-1a2b3',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.example.pdftoolkit',
      launchDate: '2025-03-14',
      category: ' Tools ',
      currentVersion: ' 2.0.4 ',
    });
    expect(app).toMatchObject({
      name: 'PDF & Image Toolkit',
      packageName: 'com.example.pdftoolkit',
      status: 'production',
      iconUrl: 'https://example.com/icon.png',
      launchDate: '2025-03-14',
      category: 'Tools',
      currentVersion: '2.0.4',
    });
  });

  it('reads blank and null optional fields as none', () => {
    const app = createAppSchema.parse({
      ...minimal,
      iconUrl: '',
      ga4PropertyId: '   ',
      firebaseProjectId: null,
      playStoreUrl: '',
      launchDate: '',
      category: '',
      currentVersion: null,
    });
    expect(app.iconUrl).toBeNull();
    expect(app.ga4PropertyId).toBeNull();
    expect(app.firebaseProjectId).toBeNull();
    expect(app.playStoreUrl).toBeNull();
    expect(app.launchDate).toBeNull();
    expect(app.category).toBeNull();
    expect(app.currentVersion).toBeNull();
  });

  it('asks for a name and a package name', () => {
    expect(issuesOf(createAppSchema, {})).toContain('name:');
    expect(issuesOf(createAppSchema, {})).toContain('packageName:');
    expect(issuesOf(createAppSchema, { ...minimal, name: '   ' })).toContain('Enter a name');
  });

  it.each([
    'grindquest',
    'com..example',
    '.com.example',
    'com.example.',
    'com.exa mple',
    'com.é.app',
  ])('refuses the package name %j', (packageName) => {
    expect(issuesOf(createAppSchema, { ...minimal, packageName })).toContain('packageName:');
  });

  it.each(['com.example.app', 'com.example.my_app2', 'io.studio.app-name', 'a.b'])(
    'accepts the package name %s',
    (packageName) => {
      expect(createAppSchema.parse({ ...minimal, packageName }).packageName).toBe(packageName);
    },
  );

  it('refuses an unknown status', () => {
    expect(issuesOf(createAppSchema, { ...minimal, status: 'archived' })).toContain('status:');
  });

  it.each([
    'http://example.com/icon.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'example.com/icon.png',
    'ftp://example.com/x',
  ])('refuses %s as a web address', (value) => {
    expect(issuesOf(createAppSchema, { ...minimal, iconUrl: value })).toContain(
      'Use a web address that starts with https://',
    );
    expect(issuesOf(createAppSchema, { ...minimal, playStoreUrl: value })).toContain(
      'playStoreUrl:',
    );
  });

  it('accepts https in any letter case', () => {
    expect(
      createAppSchema.parse({ ...minimal, iconUrl: 'HTTPS://example.com/a.png' }).iconUrl,
    ).toBe('HTTPS://example.com/a.png');
  });

  it('refuses a launch date that is not a real day', () => {
    expect(issuesOf(createAppSchema, { ...minimal, launchDate: '2026-02-31' })).toContain(
      'launchDate:',
    );
    expect(issuesOf(createAppSchema, { ...minimal, launchDate: 'March' })).toContain('launchDate:');
  });

  it('limits free text', () => {
    expect(issuesOf(createAppSchema, { ...minimal, category: 'x'.repeat(61) })).toContain(
      'Use at most 60 characters',
    );
    expect(issuesOf(createAppSchema, { ...minimal, currentVersion: 'x'.repeat(31) })).toContain(
      'Use at most 30 characters',
    );
    expect(issuesOf(createAppSchema, { ...minimal, name: 'x'.repeat(81) })).toContain(
      'Use at most 80 characters',
    );
  });

  it('refuses a Firebase project ID that is not shaped like one', () => {
    for (const bad of ['My App', 'ab', 'UPPER-case-1', '-start-bad-1', 'end-bad-']) {
      expect(issuesOf(createAppSchema, { ...minimal, firebaseProjectId: bad })).toContain(
        'firebaseProjectId:',
      );
    }
    expect(
      createAppSchema.parse({ ...minimal, firebaseProjectId: 'my-app-1a2b3' }).firebaseProjectId,
    ).toBe('my-app-1a2b3');
  });
});

describe('ga4PropertyIdSchema', () => {
  it('accepts digits, and the properties/ form people paste', () => {
    expect(ga4PropertyIdSchema.parse('123456789')).toBe('123456789');
    expect(ga4PropertyIdSchema.parse(' properties/123456789 ')).toBe('123456789');
    expect(ga4PropertyIdSchema.parse('Properties/123456789')).toBe('123456789');
  });

  it('accepts a number, as JSON clients may send', () => {
    expect(ga4PropertyIdSchema.parse(123456789)).toBe('123456789');
  });

  it('reads blank as none', () => {
    expect(ga4PropertyIdSchema.parse('')).toBeNull();
    expect(ga4PropertyIdSchema.parse(null)).toBeNull();
  });

  it.each(['G-ABC123', '12', 'properties/', '1234567890123456', 'abc', '123 456'])(
    'refuses %j, and says what to use',
    (value) => {
      const result = ga4PropertyIdSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).toContain('numeric GA4 property ID');
    },
  );
});

describe('updateAppSchema', () => {
  it('needs at least one field', () => {
    expect(issuesOf(updateAppSchema, {})).toContain('Provide at least one field to change');
  });

  it('leaves out what was not sent, instead of filling in defaults', () => {
    expect(updateAppSchema.parse({ currentVersion: '1.2.0' })).toEqual({ currentVersion: '1.2.0' });
    expect(updateAppSchema.parse({ status: 'testing' })).toEqual({ status: 'testing' });
  });

  it('clears an optional field sent as null or blank', () => {
    expect(updateAppSchema.parse({ ga4PropertyId: null })).toEqual({ ga4PropertyId: null });
    expect(updateAppSchema.parse({ iconUrl: '' })).toEqual({ iconUrl: null });
    expect(updateAppSchema.parse({ launchDate: '  ' })).toEqual({ launchDate: null });
  });

  it('does not let a required field be cleared', () => {
    expect(issuesOf(updateAppSchema, { name: '' })).toContain('name:');
    expect(issuesOf(updateAppSchema, { name: null })).toContain('name:');
    expect(issuesOf(updateAppSchema, { packageName: null })).toContain('packageName:');
  });

  it('applies the same rules as creating', () => {
    expect(issuesOf(updateAppSchema, { iconUrl: 'http://example.com/a.png' })).toContain(
      'iconUrl:',
    );
    expect(issuesOf(updateAppSchema, { ga4PropertyId: 'nope' })).toContain('ga4PropertyId:');
  });
});

describe('appRecordSchema', () => {
  const record = {
    id: 'app-1',
    name: 'Grind Quest',
    packageName: 'com.example.grindquest',
    status: 'production',
    iconUrl: null,
    ga4PropertyId: '123456789',
    firebaseProjectId: null,
    playStoreUrl: null,
    launchDate: '2025-03-14',
    category: 'Games',
    currentVersion: '1.2.0',
    createdAt: '2026-10-14T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
    createdBy: 'admin@example.com',
  };

  it('reads a stored app', () => {
    expect(appRecordSchema.parse(record)).toEqual(record);
  });

  it('does not read a document that is missing a field, so foreign documents are never taken for apps', () => {
    const { ga4PropertyId: _removed, ...incomplete } = record;
    expect(appRecordSchema.safeParse(incomplete).success).toBe(false);
    expect(appRecordSchema.safeParse({ title: 'Some other collection', price: 3 }).success).toBe(
      false,
    );
  });
});
