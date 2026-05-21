import { describe, it, expect } from 'bun:test';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'a'.repeat(40);

describe('jwt', () => {
  it('sign then verify round-trips claims', async () => {
    const token = await signJwt({ sub: 'user-1', role: 'admin' }, SECRET, 60);
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('admin');
  });

  it('rejects an expired token', async () => {
    const token = await signJwt({ sub: 'u', role: 'member' }, SECRET, -1);
    await expect(verifyJwt(token, SECRET)).rejects.toThrow();
  });

  it('rejects token signed with another secret', async () => {
    const token = await signJwt({ sub: 'u', role: 'member' }, SECRET, 60);
    await expect(verifyJwt(token, 'b'.repeat(40))).rejects.toThrow();
  });
});
