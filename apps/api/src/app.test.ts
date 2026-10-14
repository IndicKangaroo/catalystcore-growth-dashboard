import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { ConfigError, loadConfig } from './lib/config';

// No Firebase dependencies: this is how the API runs before sign-in has been configured.
const app = createApp(loadConfig({ NODE_ENV: 'test' }));

describe('GET /api/health', () => {
  it('is public and reports the active analytics provider', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', provider: 'seed' });
  });
});

describe('when sign-in is not configured', () => {
  it('answers 503 with the standard error shape on protected routes', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('auth_not_configured');
  });
});

describe('error handling', () => {
  it('returns the consistent error shape for unknown routes outside /api', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'No route for GET /nope' } });
  });

  it('returns 400 with the error shape for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(8787);
    expect(config.ANALYTICS_PROVIDER).toBe('seed');
    expect(config.NODE_ENV).toBe('development');
  });

  it('treats empty optional values as unset', () => {
    const config = loadConfig({ FIREBASE_PROJECT_ID: '', ADMIN_EMAIL: '  ' });
    expect(config.FIREBASE_PROJECT_ID).toBeUndefined();
    expect(config.ADMIN_EMAIL).toBeUndefined();
  });

  it('rejects an unknown analytics provider and names the field', () => {
    expect(() => loadConfig({ ANALYTICS_PROVIDER: 'mixpanel' })).toThrow(ConfigError);
    expect(() => loadConfig({ ANALYTICS_PROVIDER: 'mixpanel' })).toThrow(/ANALYTICS_PROVIDER/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(ConfigError);
  });
});
