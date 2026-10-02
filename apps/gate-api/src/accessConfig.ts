import type { AccessOptions } from './server.js';

/**
 * Cloudflare Access settings from the process environment.
 *
 * Team and audience turn Access on. They are required together. The legacy
 * single-email pair is optional, and it is also required together: a half-set
 * pair would boot a server that looks locked to one person and is not.
 *
 * Staff who have `app_users.email` do not need the pair. It remains so a row
 * created before the email column still signs in until that column is filled.
 */
export function accessConfigFromEnv(env: NodeJS.ProcessEnv): AccessOptions | undefined {
  const team = env.APEX_ACCESS_TEAM?.trim() || undefined;
  const audience = env.APEX_ACCESS_AUD?.trim() || undefined;
  const email = env.APEX_ACCESS_EMAIL?.trim() || undefined;
  const userId = env.APEX_ACCESS_USER_ID?.trim() || undefined;
  if (team === undefined && audience === undefined && email === undefined && userId === undefined) {
    return undefined;
  }

  const missing: string[] = [];
  if (team === undefined) missing.push('APEX_ACCESS_TEAM');
  if (audience === undefined) missing.push('APEX_ACCESS_AUD');
  if ((email === undefined) !== (userId === undefined)) {
    if (email === undefined) missing.push('APEX_ACCESS_EMAIL');
    if (userId === undefined) missing.push('APEX_ACCESS_USER_ID');
  }
  if (missing.length > 0) {
    throw new Error(`Cloudflare Access is partly configured; these are missing: ${missing.join(', ')}.`);
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(team!)) {
    throw new Error('APEX_ACCESS_TEAM must be the Access team subdomain, not a full URL.');
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('APEX_ACCESS_EMAIL must be a single email address.');
  }
  if (userId !== undefined && !/^user_[0-9A-HJKMNP-TV-Z]{26}$/.test(userId)) {
    throw new Error('APEX_ACCESS_USER_ID must be a canonical user_<ULID> identifier.');
  }

  return {
    team: team!.toLowerCase(),
    audience: audience!,
    ...(email !== undefined && userId !== undefined
      ? { email: email.toLowerCase(), userId }
      : {}),
  };
}
