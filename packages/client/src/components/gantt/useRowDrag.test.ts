import { describe, it, expect } from 'vitest';
import { computeDropIndex, reorderArray } from './useRowDrag';

const rowTops = [0, 36, 72, 108, 144]; // 5 rows of height 36

describe('computeDropIndex', () => {
  it('above first row → index 0', () => {
    expect(computeDropIndex(2, -10, rowTops, 36)).toBe(0);
  });
  it('inside row i (top half) → index i', () => {
    expect(computeDropIndex(0, 40, rowTops, 36)).toBe(1); // pointer in row 1 top half → insertion before row 1 = index 1
  });
  it('inside row i (bottom half) → index i+1', () => {
    expect(computeDropIndex(0, 60, rowTops, 36)).toBe(2);
  });
  it('below last row → rowTops.length', () => {
    expect(computeDropIndex(0, 500, rowTops, 36)).toBe(5);
  });
});

describe('reorderArray', () => {
  it('returns original when dst equals src', () => {
    const a = ['a', 'b', 'c'];
    expect(reorderArray(a, 1, 1)).toBe(a);
  });
  it('returns original when dst equals src+1 (no-op same slot)', () => {
    const a = ['a', 'b', 'c'];
    expect(reorderArray(a, 1, 2)).toBe(a);
  });
  it('moves item down', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves item up', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('moves item to end', () => {
    expect(reorderArray(['a', 'b', 'c', 'd'], 0, 4)).toEqual(['b', 'c', 'd', 'a']);
  });
});
