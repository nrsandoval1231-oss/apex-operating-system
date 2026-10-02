import { describe, expect, it } from 'vitest';
import { accessConfigFromEnv } from './accessConfig.js';

const team = 'apex-test';
const audience = 'aud-staging-test';
const email = 'Owner@Example.com';
const userId = 'user_01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('accessConfigFromEnv', () => {
  it('stays off when nothing is set', () => {
    expect(accessConfigFromEnv({})).toBeUndefined();
  });

  it('turns Access on with team and audience and no legacy pair', () => {
    expect(accessConfigFromEnv({ APEX_ACCESS_TEAM: team, APEX_ACCESS_AUD: audience })).toEqual({
      team,
      audience,
    });
  });

  it('keeps the legacy pair, lower-cased, when both values are set', () => {
    expect(accessConfigFromEnv({
      APEX_ACCESS_TEAM: 'Apex-Test',
      APEX_ACCESS_AUD: audience,
      APEX_ACCESS_EMAIL: email,
      APEX_ACCESS_USER_ID: userId,
    })).toEqual({
      team,
      audience,
      email: 'owner@example.com',
      userId,
    });
  });

  it('refuses a half-set legacy pair or a half-set team', () => {
    expect(() => accessConfigFromEnv({
      APEX_ACCESS_TEAM: team,
      APEX_ACCESS_AUD: audience,
      APEX_ACCESS_EMAIL: email,
    })).toThrow(/APEX_ACCESS_USER_ID/);
    expect(() => accessConfigFromEnv({ APEX_ACCESS_TEAM: team })).toThrow(/APEX_ACCESS_AUD/);
    expect(() => accessConfigFromEnv({ APEX_ACCESS_EMAIL: email })).toThrow(/partly configured/i);
  });

  it('refuses a URL team, a bad email, and a bad user id', () => {
    expect(() => accessConfigFromEnv({
      APEX_ACCESS_TEAM: 'https://apex.cloudflareaccess.com',
      APEX_ACCESS_AUD: audience,
    })).toThrow(/subdomain/i);
    expect(() => accessConfigFromEnv({
      APEX_ACCESS_TEAM: team,
      APEX_ACCESS_AUD: audience,
      APEX_ACCESS_EMAIL: 'not-an-email',
      APEX_ACCESS_USER_ID: userId,
    })).toThrow(/email/i);
    expect(() => accessConfigFromEnv({
      APEX_ACCESS_TEAM: team,
      APEX_ACCESS_AUD: audience,
      APEX_ACCESS_EMAIL: email,
      APEX_ACCESS_USER_ID: 'user_not_a_ulid',
    })).toThrow(/user_/i);
  });
});
