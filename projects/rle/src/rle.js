// Run-Length Encoding

export function encode(input) {
  if (!input) return '';
  let result = '';
  let count = 1;
  for (let i = 1; i <= input.length; i++) {
    if (i < input.length && input[i] === input[i - 1]) { count++; }
    else { result += (count > 1 ? String(count) : '') + input[i - 1]; count = 1; }
  }
  return result;
}

export function decode(input) {
  if (!input) return '';
  let result = '';
  let num = '';
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') { num += ch; }
    else { const count = num ? parseInt(num) : 1; result += ch.repeat(count); num = ''; }
  }
  return result;
}

// Binary RLE (for Uint8Array)
export function encodeBinary(data) {
  const result = [];
  let i = 0;
  while (i < data.length) {
    const val = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === val && count < 255) count++;
    result.push(count, val);
    i += count;
  }
  return new Uint8Array(result);
}

export function decodeBinary(data) {
  const result = [];
  for (let i = 0; i < data.length; i += 2) {
    const count = data[i], val = data[i + 1];
    for (let j = 0; j < count; j++) result.push(val);
  }
  return new Uint8Array(result);
}

export function compressionRatio(input) {
  const encoded = encode(input);
  return 1 - encoded.length / input.length;
}
