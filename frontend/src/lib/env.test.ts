import { describe, expect, it } from 'vitest';
import { getSupabaseEnv } from './env';

type EnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY';
const env = import.meta.env as Record<EnvKey, string | undefined>;

/**
 * This Vitest setup backs `import.meta.env` with real `process.env`, which coerces any
 * assigned value to a string — `Object.assign(import.meta.env, { KEY: undefined })`
 * does not unset `KEY`, it sets it to the literal string `"undefined"`. `delete` is the
 * only way to make a key genuinely absent, so "missing" and "set" are two distinct
 * helpers rather than one function taking `string | undefined`.
 */
function unset(...keys: EnvKey[]) {
  for (const key of keys) delete env[key];
}
function set(key: EnvKey, value: string) {
  env[key] = value;
}

describe('getSupabaseEnv', () => {
  it('throws naming every missing variable when both are absent', () => {
    unset('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY');

    expect(() => getSupabaseEnv()).toThrow(/VITE_SUPABASE_URL.*VITE_SUPABASE_PUBLISHABLE_KEY/s);
  });

  it('throws naming only the missing one when only one is set', () => {
    set('VITE_SUPABASE_URL', 'https://example.supabase.co');
    unset('VITE_SUPABASE_PUBLISHABLE_KEY');

    let thrown: unknown;
    try {
      getSupabaseEnv();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect((thrown as Error).message).not.toContain('VITE_SUPABASE_URL,');
  });

  it('treats a blank string the same as missing', () => {
    set('VITE_SUPABASE_URL', '');
    set('VITE_SUPABASE_PUBLISHABLE_KEY', 'key');

    expect(() => getSupabaseEnv()).toThrow('VITE_SUPABASE_URL');
  });

  it('returns both values once both are set', () => {
    set('VITE_SUPABASE_URL', 'https://example.supabase.co');
    set('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');

    expect(getSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });
});
