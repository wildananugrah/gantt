import { describe, it, expect } from 'bun:test';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hash and verify round-trips', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('verify returns false on bad password', async () => {
    const hash = await hashPassword('a');
    expect(await verifyPassword('b', hash)).toBe(false);
  });
});
