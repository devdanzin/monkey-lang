// Diff Algorithm — Myers diff for text/arrays
// Based on Eugene Myers' "An O(ND) Difference Algorithm"

export const EQUAL = 'equal';
export const INSERT = 'insert';
export const DELETE = 'delete';

// Compute shortest edit script (Myers algorithm)
export function diff(a, b) {
  const n = a.length, m = b.length;
  const max = n + m;
  const trace = [];

  // V[k] stores the furthest reaching x on diagonal k
  const v = new Map();
  v.set(1, 0);

  outer:
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
        x = v.get(k + 1) ?? 0; // Move down (insert)
      } else {
        x = (v.get(k - 1) ?? 0) + 1; // Move right (delete)
      }

      let y = x - k;

      // Follow diagonal (equal elements)
      while (x < n && y < m && a[x] === b[y]) {
        x++; y++;
      }

      v.set(k, x);

      if (x >= n && y >= m) break outer;
    }
  }

  // Backtrack to find the edit script
  return backtrack(trace, a, b);
}

function backtrack(trace, a, b) {
  const n = a.length, m = b.length;
  let x = n, y = m;
  const edits = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    // Diagonal (equal)
    while (x > prevX && y > prevY) {
      x--; y--;
      edits.unshift({ type: EQUAL, value: a[x] });
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        edits.unshift({ type: INSERT, value: b[y] });
      } else {
        // Delete
        x--;
        edits.unshift({ type: DELETE, value: a[x] });
      }
    }
  }

  return edits;
}

// Diff two strings by lines
export function diffLines(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  return diff(oldLines, newLines);
}

// Diff two strings by characters
export function diffChars(oldText, newText) {
  return diff([...oldText], [...newText]);
}

// Format diff as unified diff string
export function formatUnified(edits, { context = 3 } = {}) {
  const lines = [];
  let oldLine = 1, newLine = 1;

  for (const edit of edits) {
    switch (edit.type) {
      case EQUAL:
        lines.push(` ${edit.value}`);
        oldLine++; newLine++;
        break;
      case DELETE:
        lines.push(`-${edit.value}`);
        oldLine++;
        break;
      case INSERT:
        lines.push(`+${edit.value}`);
        newLine++;
        break;
    }
  }

  return lines.join('\n');
}

// Compute patch (array of hunks)
export function patch(edits) {
  const hunks = [];
  let currentHunk = null;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];

    if (edit.type !== EQUAL) {
      if (!currentHunk) {
        currentHunk = { edits: [] };
        // Include some context before
        for (let j = Math.max(0, i - 3); j < i; j++) {
          currentHunk.edits.push(edits[j]);
        }
      }
      currentHunk.edits.push(edit);
    } else if (currentHunk) {
      currentHunk.edits.push(edit);
      // Check if we're far enough from changes to end hunk
      const remaining = edits.slice(i + 1, i + 4);
      if (remaining.every(e => e.type === EQUAL) || i === edits.length - 1) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

// Apply edits to reconstruct the new array
export function applyEdits(edits) {
  return edits
    .filter(e => e.type === EQUAL || e.type === INSERT)
    .map(e => e.value);
}

// Edit distance (number of insertions + deletions)
export function editDistance(a, b) {
  const edits = diff(a, b);
  return edits.filter(e => e.type !== EQUAL).length;
}
