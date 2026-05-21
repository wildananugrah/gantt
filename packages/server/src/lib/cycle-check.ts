/**
 * Returns true if adding edge predecessor → successor would create a cycle.
 * DFS forward from successor; if we can reach predecessor, a back edge would close a loop.
 * Self-edges are treated as cycles.
 */
export async function wouldCreateCycle(
  predecessorId: string,
  successorId: string,
  fetchSuccessors: (id: string) => Promise<string[]>,
): Promise<boolean> {
  if (predecessorId === successorId) return true;
  const seen = new Set<string>();
  const stack = [successorId];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === predecessorId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    const next = await fetchSuccessors(node);
    for (const n of next) stack.push(n);
  }
  return false;
}
