import { describe, expect, it } from 'vitest';
import { errorFields } from './logger';

describe('errorFields', () => {
  it('names the error, its message and its code', () => {
    const err = Object.assign(new Error('boom'), { code: 14 });

    expect(errorFields(err)).toEqual({ errorName: 'Error', errorMessage: 'boom', errorCode: 14 });
  });

  it('leaves out the code when there is none', () => {
    expect(errorFields(new TypeError('bad'))).toEqual({
      errorName: 'TypeError',
      errorMessage: 'bad',
    });
  });

  it('describes something thrown that is not an error', () => {
    expect(errorFields('oops')).toEqual({ errorName: 'unknown', errorMessage: 'oops' });
  });

  it('never uses the key "message", which would replace the log line’s own message', () => {
    expect(errorFields(new Error('boom'))).not.toHaveProperty('message');
  });
});
