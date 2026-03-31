/**
 * Tiny LZ77 Compressor
 * 
 * Sliding window compression:
 * - Encode: find longest match in window, emit (offset, length, next) triples
 * - Decode: reconstruct from triples
 * - Configurable window size and lookahead
 */

function encode(input, windowSize = 4096, lookaheadSize = 18) {
  const tokens = [];
  let pos = 0;

  while (pos < input.length) {
    let bestOffset = 0;
    let bestLength = 0;

    const searchStart = Math.max(0, pos - windowSize);
    const lookaheadEnd = Math.min(pos + lookaheadSize, input.length);

    for (let i = searchStart; i < pos; i++) {
      let len = 0;
      while (pos + len < lookaheadEnd && input[i + len] === input[pos + len]) {
        len++;
        // Allow matching into lookahead (for repeating patterns)
        if (i + len === pos) break;
      }
      if (len > bestLength) {
        bestLength = len;
        bestOffset = pos - i;
      }
    }

    if (bestLength >= 3) {
      // Match found: (offset, length, next char or null)
      const nextChar = pos + bestLength < input.length ? input[pos + bestLength] : '';
      tokens.push([bestOffset, bestLength, nextChar]);
      pos += bestLength + 1;
    } else {
      // Literal: (0, 0, char)
      tokens.push([0, 0, input[pos]]);
      pos += 1;
    }
  }

  return tokens;
}

function decode(tokens) {
  let output = '';

  for (const [offset, length, next] of tokens) {
    if (length > 0) {
      const start = output.length - offset;
      for (let i = 0; i < length; i++) {
        output += output[start + i];
      }
    }
    if (next !== undefined && next !== '') {
      output += next;
    }
  }

  return output;
}

/**
 * Compress to a compact binary format
 * Format per token: [flag byte][offset (2 bytes if match)][length (1 byte if match)][char (1 byte)]
 */
function compress(input) {
  const tokens = encode(input);
  const bytes = [];
  
  for (const [offset, length, next] of tokens) {
    if (length > 0) {
      bytes.push(1); // match flag
      bytes.push((offset >> 8) & 0xFF);
      bytes.push(offset & 0xFF);
      bytes.push(length);
      bytes.push(next ? next.charCodeAt(0) : 0);
    } else {
      bytes.push(0); // literal flag
      bytes.push(next ? next.charCodeAt(0) : 0);
    }
  }
  
  return new Uint8Array(bytes);
}

function decompress(bytes) {
  let output = '';
  let i = 0;
  
  while (i < bytes.length) {
    const flag = bytes[i++];
    if (flag === 1) {
      const offset = (bytes[i++] << 8) | bytes[i++];
      const length = bytes[i++];
      const charCode = bytes[i++];
      
      const start = output.length - offset;
      for (let j = 0; j < length; j++) {
        output += output[start + j];
      }
      if (charCode !== 0) output += String.fromCharCode(charCode);
    } else {
      output += String.fromCharCode(bytes[i++]);
    }
  }
  
  return output;
}

function compressionRatio(original, compressed) {
  return compressed.length / original.length;
}

module.exports = { encode, decode, compress, decompress, compressionRatio };
