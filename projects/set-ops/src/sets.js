// Set operations
export function union(a, b) { return new Set([...a, ...b]); }
export function intersection(a, b) { return new Set([...a].filter(x => b.has(x))); }
export function difference(a, b) { return new Set([...a].filter(x => !b.has(x))); }
export function symmetricDifference(a, b) { return union(difference(a, b), difference(b, a)); }
export function isSubset(a, b) { return [...a].every(x => b.has(x)); }
export function isSuperset(a, b) { return isSubset(b, a); }
export function isDisjoint(a, b) { return intersection(a, b).size === 0; }
export function equals(a, b) { return a.size === b.size && isSubset(a, b); }
export function powerSet(s) {
  const arr = [...s]; const result = [new Set()];
  for (const item of arr) { const newSets = result.map(set => new Set([...set, item])); result.push(...newSets); }
  return result;
}
