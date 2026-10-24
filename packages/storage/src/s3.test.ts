import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { S3EvidenceStorage } from './s3.js';

let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); });

describe('S3 write preflight', () => {
  it('does not treat a denied existence check as an absent object', async () => {
    const methods: string[] = [];
    server = createServer((request, response) => {
      methods.push(request.method!);
      response.writeHead(request.method === 'HEAD' ? 403 : 200);
      response.end();
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address');
    const storage = new S3EvidenceStorage({ endpoint: `http://127.0.0.1:${address.port}`, bucket: 'test',
      region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'test' });
    await expect(storage.put('job_test/gate_test/evidence_test.jpg', Buffer.from('proof'), 'image/jpeg'))
      .rejects.toThrow(/403/);
    expect(methods).toEqual(['HEAD']);
  });
});
