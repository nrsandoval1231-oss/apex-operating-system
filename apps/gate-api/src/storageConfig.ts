import type { S3Options } from '@apex/storage';

/** All-or-none configuration prevents evidence silently falling back to local disk. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv): S3Options | undefined {
  const values = {
    endpoint: env.S3_ENDPOINT?.trim(),
    bucket: env.S3_BUCKET?.trim(),
    accessKeyId: env.S3_ACCESS_KEY_ID?.trim(),
    secretAccessKey: env.S3_SECRET_ACCESS_KEY?.trim(),
  };
  if (!Object.values(values).some(Boolean) && !env.S3_REGION?.trim()) return undefined;
  const names = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const missing = Object.values(values).flatMap((value, index) => value ? [] : [names[index]]);
  if (missing.length > 0) throw new Error(`S3 is partly configured; these are missing: ${missing.join(', ')}.`);
  return { endpoint: values.endpoint!, bucket: values.bucket!, accessKeyId: values.accessKeyId!,
    secretAccessKey: values.secretAccessKey!, region: env.S3_REGION?.trim() || 'auto' };
}
