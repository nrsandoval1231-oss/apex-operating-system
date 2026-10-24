import { describe, expect, it } from 'vitest';
import { s3ConfigFromEnv } from './storageConfig.js';

const configured = { S3_ENDPOINT: 'https://s3.example.com', S3_BUCKET: 'evidence',
  S3_ACCESS_KEY_ID: 'test-id', S3_SECRET_ACCESS_KEY: 'test-secret' };
describe('evidence storage configuration', () => {
  it('uses local storage only when S3 is unconfigured', () => {
    expect(s3ConfigFromEnv({})).toBeUndefined();
    expect(s3ConfigFromEnv({ S3_ENDPOINT: '  ' })).toBeUndefined();
  });
  for (const name of Object.keys(configured)) {
    it(`refuses configuration missing ${name}`, () => {
      const env: NodeJS.ProcessEnv = { ...configured }; delete env[name];
      expect(() => s3ConfigFromEnv(env)).toThrow(name);
    });
  }
  it('refuses a region-only configuration', () => {
    expect(() => s3ConfigFromEnv({ S3_REGION: 'us-east-1' })).toThrow('S3_ENDPOINT');
  });
  it('trims complete configuration without logging credentials', () => {
    expect(s3ConfigFromEnv({ ...configured, S3_BUCKET: ' evidence ', S3_REGION: ' us-east-1 ' }))
      .toEqual({ endpoint: configured.S3_ENDPOINT, bucket: 'evidence', accessKeyId: 'test-id',
        secretAccessKey: 'test-secret', region: 'us-east-1' });
  });
});
