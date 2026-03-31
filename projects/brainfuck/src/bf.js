// Brainfuck interpreter

export function interpret(code, input = '') {
  const tape = new Uint8Array(30000);
  let ptr = 0, pc = 0, ip = 0;
  let output = '';

  // Pre-compute bracket jumps
  const jumps = new Map();
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '[') stack.push(i);
    else if (code[i] === ']') {
      if (stack.length === 0) throw new Error(`Unmatched ] at position ${i}`);
      const open = stack.pop();
      jumps.set(open, i);
      jumps.set(i, open);
    }
  }
  if (stack.length > 0) throw new Error(`Unmatched [ at position ${stack[stack.length - 1]}`);

  let steps = 0;
  const maxSteps = 10_000_000;

  while (pc < code.length) {
    if (++steps > maxSteps) throw new Error('Execution limit exceeded');
    switch (code[pc]) {
      case '>': ptr = (ptr + 1) % 30000; break;
      case '<': ptr = (ptr - 1 + 30000) % 30000; break;
      case '+': tape[ptr] = (tape[ptr] + 1) & 0xFF; break;
      case '-': tape[ptr] = (tape[ptr] - 1) & 0xFF; break;
      case '.': output += String.fromCharCode(tape[ptr]); break;
      case ',': tape[ptr] = ip < input.length ? input.charCodeAt(ip++) : 0; break;
      case '[': if (tape[ptr] === 0) pc = jumps.get(pc); break;
      case ']': if (tape[ptr] !== 0) pc = jumps.get(pc); break;
    }
    pc++;
  }

  return output;
}

export function compile(code) {
  // Compile to optimized ops
  const ops = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if ('><+-'.includes(ch)) {
      let count = 1;
      while (i + 1 < code.length && code[i + 1] === ch) { count++; i++; }
      ops.push({ op: ch, count });
    } else if ('.,[]'.includes(ch)) {
      ops.push({ op: ch });
    }
  }

  // Resolve jumps
  const stack = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].op === '[') stack.push(i);
    else if (ops[i].op === ']') {
      const open = stack.pop();
      ops[open].jump = i;
      ops[i].jump = open;
    }
  }

  return function run(input = '') {
    const tape = new Uint8Array(30000);
    let ptr = 0, pc = 0, ip = 0;
    let output = '';
    let steps = 0;
    while (pc < ops.length) {
      if (++steps > 10_000_000) throw new Error('Execution limit exceeded');
      const { op, count, jump } = ops[pc];
      switch (op) {
        case '>': ptr = (ptr + count) % 30000; break;
        case '<': ptr = (ptr - count + 30000) % 30000; break;
        case '+': tape[ptr] = (tape[ptr] + count) & 0xFF; break;
        case '-': tape[ptr] = (tape[ptr] - count) & 0xFF; break;
        case '.': output += String.fromCharCode(tape[ptr]); break;
        case ',': tape[ptr] = ip < input.length ? input.charCodeAt(ip++) : 0; break;
        case '[': if (tape[ptr] === 0) pc = jump; break;
        case ']': if (tape[ptr] !== 0) pc = jump; break;
      }
      pc++;
    }
    return output;
  };
}

export function minify(code) {
  return code.replace(/[^><+\-.,\[\]]/g, '');
}
