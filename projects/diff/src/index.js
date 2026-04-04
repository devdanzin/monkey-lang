// ===== Diff Algorithm =====
// Myers diff for computing minimal edit scripts

// ===== Edit operations =====
export const Op = { EQUAL: 'equal', INSERT: 'insert', DELETE: 'delete' };

// ===== Myers Diff =====
// Computes shortest edit script (SES) between two sequences

export function diff(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  
  if (max === 0) return [];
  
  // V[k] = furthest reaching d-path endpoint on diagonal k
  const v = { 0: 0 };
  const trace = [];
  
  outer:
  for (let d = 0; d <= max; d++) {
    trace.push({ ...v });
    
    for (let k = -d; k <= d; k += 2) {
      let x;
      
      // Move down (insert) or right (delete)
      if (k === -d || (k !== d && (v[k - 1] ?? -1) < (v[k + 1] ?? -1))) {
        x = v[k + 1] ?? 0; // insert: come from k+1
      } else {
        x = (v[k - 1] ?? 0) + 1; // delete: come from k-1
      }
      
      let y = x - k;
      
      // Follow diagonal (equal elements)
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      
      v[k] = x;
      
      if (x >= n && y >= m) break outer;
    }
  }
  
  // Backtrack to find the actual edit script
  return backtrack(a, b, trace);
}

function backtrack(a, b, trace) {
  let x = a.length;
  let y = b.length;
  const ops = [];
  
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    
    let prevK;
    if (k === -d || (k !== d && (v[k - 1] ?? -1) < (v[k + 1] ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v[prevK] ?? 0;
    const prevY = prevX - prevK;
    
    // Diagonal moves (equal)
    while (x > prevX && y > prevY) {
      x--; y--;
      ops.unshift({ op: Op.EQUAL, value: a[x] });
    }
    
    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        ops.unshift({ op: Op.INSERT, value: b[y] });
      } else {
        // Delete
        x--;
        ops.unshift({ op: Op.DELETE, value: a[x] });
      }
    }
  }
  
  return ops;
}

// ===== Line-based diff =====

export function diffLines(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  return diff(linesA, linesB);
}

// ===== Unified diff format =====

export function unifiedDiff(textA, textB, { fileA = 'a', fileB = 'b', context = 3 } = {}) {
  const ops = diffLines(textA, textB);
  
  const lines = [`--- ${fileA}`, `+++ ${fileB}`];
  
  // Generate hunks
  const hunks = [];
  let currentHunk = null;
  let lineA = 0, lineB = 0;
  
  for (let i = 0; i < ops.length; i++) {
    const { op, value } = ops[i];
    
    if (op !== Op.EQUAL) {
      // Start new hunk if needed
      if (!currentHunk) {
        const startA = Math.max(0, lineA - context);
        const startB = Math.max(0, lineB - context);
        currentHunk = { startA, startB, lines: [] };
        
        // Add context before
        for (let j = Math.max(0, i - context); j < i; j++) {
          if (ops[j].op === Op.EQUAL) currentHunk.lines.push(' ' + ops[j].value);
        }
      }
    }
    
    if (currentHunk) {
      if (op === Op.EQUAL) currentHunk.lines.push(' ' + value);
      else if (op === Op.DELETE) currentHunk.lines.push('-' + value);
      else if (op === Op.INSERT) currentHunk.lines.push('+' + value);
    }
    
    if (op === Op.EQUAL || op === Op.DELETE) lineA++;
    if (op === Op.EQUAL || op === Op.INSERT) lineB++;
  }
  
  if (currentHunk) hunks.push(currentHunk);
  
  for (const hunk of hunks) {
    const countA = hunk.lines.filter(l => l[0] === ' ' || l[0] === '-').length;
    const countB = hunk.lines.filter(l => l[0] === ' ' || l[0] === '+').length;
    lines.push(`@@ -${hunk.startA + 1},${countA} +${hunk.startB + 1},${countB} @@`);
    lines.push(...hunk.lines);
  }
  
  return lines.join('\n');
}

// ===== Apply patch =====

export function applyPatch(original, ops) {
  const result = [];
  for (const { op, value } of ops) {
    if (op === Op.EQUAL || op === Op.INSERT) result.push(value);
    // DELETE: skip
  }
  return result;
}

// ===== Edit distance =====

export function editDistance(a, b) {
  const ops = diff(a, b);
  return ops.filter(o => o.op !== Op.EQUAL).length;
}
