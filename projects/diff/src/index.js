/**
 * Tiny Diff — Myers Algorithm
 * 
 * Compute shortest edit script between two sequences:
 * - Myers diff (O((N+M)D) time)
 * - Unified diff format output
 * - Patch apply
 * - Line-level and character-level diff
 */

function diff(a, b) {
  const n = a.length, m = b.length;
  const max = n + m;
  const v = new Map();
  v.set(1, 0);
  const trace = [];

  for (let d = 0; d <= max; d++) {
    const vSnap = new Map(v);
    trace.push(vSnap);
    
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && (v.get(k - 1) || 0) < (v.get(k + 1) || 0))) {
        x = v.get(k + 1) || 0; // move down
      } else {
        x = (v.get(k - 1) || 0) + 1; // move right
      }
      let y = x - k;
      
      // Follow diagonal (matches)
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      
      v.set(k, x);
      
      if (x >= n && y >= m) {
        return backtrack(trace, a, b, n, m);
      }
    }
  }
  return [];
}

function backtrack(trace, a, b, n, m) {
  const edits = [];
  let x = n, y = m;
  
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    
    let prevK;
    if (k === -d || (k !== d && (v.get(k - 1) || 0) < (v.get(k + 1) || 0))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v.get(prevK) || 0;
    const prevY = prevX - prevK;
    
    // Diagonal moves (equal)
    while (x > prevX && y > prevY) {
      x--; y--;
      edits.unshift({ type: 'equal', value: a[x] });
    }
    
    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        edits.unshift({ type: 'insert', value: b[y] });
      } else {
        // Delete
        x--;
        edits.unshift({ type: 'delete', value: a[x] });
      }
    }
  }
  
  return edits;
}

function diffLines(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  return diff(linesA, linesB);
}

function unified(edits, contextLines = 3) {
  const lines = [];
  
  for (const edit of edits) {
    switch (edit.type) {
      case 'equal': lines.push(` ${edit.value}`); break;
      case 'delete': lines.push(`-${edit.value}`); break;
      case 'insert': lines.push(`+${edit.value}`); break;
    }
  }
  
  return lines.join('\n');
}

function patch(original, edits) {
  const result = [];
  for (const edit of edits) {
    if (edit.type === 'equal' || edit.type === 'insert') {
      result.push(edit.value);
    }
    // delete: skip
  }
  return result;
}

function patchText(text, edits) {
  return patch(null, edits).join('\n');
}

function diffChars(a, b) {
  return diff(a.split(''), b.split(''));
}

function editDistance(a, b) {
  const edits = diff(
    typeof a === 'string' ? a.split('') : a,
    typeof b === 'string' ? b.split('') : b
  );
  return edits.filter(e => e.type !== 'equal').length;
}

module.exports = { diff, diffLines, diffChars, unified, patch, patchText, editDistance };
