import { describe, expect, it } from 'vitest';
import { Ga4Error, describeGa4Error } from './client';

describe('describeGa4Error', () => {
  it('tells the person to add the service account as a Viewer when access is refused', () => {
    const err = describeGa4Error({ code: 7, message: 'denied' }, '123');

    expect(err).toBeInstanceOf(Ga4Error);
    expect(err.message).toContain('property 123');
    expect(err.message).toContain('Viewer');
  });

  it('names an unknown property and a bad key', () => {
    expect(describeGa4Error({ code: 5 }, '123').message).toContain('was not found');
    expect(describeGa4Error({ code: 16 }, '123').message).toContain('service account key');
  });

  it('passes any other failure on in words', () => {
    expect(describeGa4Error(new Error('socket hang up'), '123').message).toContain(
      'socket hang up',
    );
  });
});
