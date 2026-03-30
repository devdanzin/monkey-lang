# CHIP-8 Emulator

A CHIP-8 virtual machine emulator built from scratch in JavaScript. Zero dependencies.

## Features

- **Complete CPU** — All 35 original opcodes implemented
- **4KB Memory** — Proper memory layout with font sprites at 0x050
- **16 Registers** — V0-VF with carry flag (VF)
- **64×32 Display** — XOR sprite rendering with collision detection
- **Hex Keypad** — 16-key input mapped to keyboard
- **Timers** — Delay and sound timers at 60Hz
- **Disassembler** — Human-readable opcode disassembly
- **40 Tests** — Every opcode category covered

## Browser Demo

- Canvas renderer (10x scaled)
- Keyboard mapping: 1234/QWER/ASDF/ZXCV → CHIP-8 hex keypad
- On-screen clickable keypad
- Drag-and-drop ROM loading (.ch8 files)
- Built-in ROMs: Maze, Sierpinski, Particle
- Register viewer, cycle counter
- Step debugger, speed control

## Architecture

```
ROM → Memory[0x200..] → Fetch → Decode → Execute → Display
                                              ↑
                                         Keyboard Input
```

The CPU runs a fetch-decode-execute cycle:
1. **Fetch** — Read 2-byte big-endian opcode from memory at PC
2. **Decode** — Extract fields: nnn (12-bit addr), nn (8-bit), n (4-bit), x/y (register indices)
3. **Execute** — Dispatch on top nibble, then sub-fields

## Opcodes

| Category | Opcodes | Description |
|----------|---------|-------------|
| Flow | 1nnn, 2nnn, 00EE, Bnnn | Jump, call, return |
| Skip | 3xnn, 4xnn, 5xy0, 9xy0 | Conditional skip |
| Load | 6xnn, Annn, Fx07, Fx0A | Set registers |
| Math | 7xnn, 8xy0-8xyE | ALU operations |
| Memory | Fx33, Fx55, Fx65 | BCD, store/load |
| Display | 00E0, Dxyn | Clear, draw sprite |
| Input | Ex9E, ExA1 | Key press/release |
| Timer | Fx15, Fx18 | Set delay/sound |

## Run Tests

```bash
npm test
```

## License

MIT
