import { describe, it, expect } from 'bun:test';
import { wouldCreateCycle } from './cycle-check';

const edges: Record<string, string[]> = {
  A: ['B'],
  B: ['C'],
  C: [],
  D: ['A'],
};

const fetchSuccessors = async (id: string) => edges[id] ?? [];

describe('wouldCreateCycle', () => {
  it('detects direct back-edge', async () => {
    expect(await wouldCreateCycle('C', 'A', fetchSuccessors)).toBe(true);
  });

  it('returns false for a fresh edge', async () => {
    expect(await wouldCreateCycle('D', 'C', fetchSuccessors)).toBe(false);
  });

  it('treats self-edge as cycle', async () => {
    expect(await wouldCreateCycle('A', 'A', fetchSuccessors)).toBe(true);
  });
});
