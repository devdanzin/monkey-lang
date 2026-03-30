// CHIP-8 CPU Emulator
// Reference: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM

// Built-in font sprites (0-F), 5 bytes each, loaded at 0x050
const FONT = new Uint8Array([
  0xF0,0x90,0x90,0x90,0xF0, // 0
  0x20,0x60,0x20,0x20,0x70, // 1
  0xF0,0x10,0xF0,0x80,0xF0, // 2
  0xF0,0x10,0xF0,0x10,0xF0, // 3
  0x90,0x90,0xF0,0x10,0x10, // 4
  0xF0,0x80,0xF0,0x10,0xF0, // 5
  0xF0,0x80,0xF0,0x90,0xF0, // 6
  0xF0,0x10,0x20,0x40,0x40, // 7
  0xF0,0x90,0xF0,0x90,0xF0, // 8
  0xF0,0x90,0xF0,0x10,0xF0, // 9
  0xF0,0x90,0xF0,0x90,0x90, // A
  0xE0,0x90,0xE0,0x90,0xE0, // B
  0xF0,0x80,0x80,0x80,0xF0, // C
  0xE0,0x90,0x90,0x90,0xE0, // D
  0xF0,0x80,0xF0,0x80,0xF0, // E
  0xF0,0x80,0xF0,0x80,0x80, // F
]);

export class Chip8 {
  constructor() {
    this.reset();
  }

  reset() {
    // 4KB memory
    this.memory = new Uint8Array(4096);
    // Load font at 0x050
    this.memory.set(FONT, 0x050);

    // 16 general-purpose 8-bit registers (V0-VF)
    this.V = new Uint8Array(16);
    // Index register (16-bit)
    this.I = 0;
    // Program counter (starts at 0x200)
    this.pc = 0x200;
    // Stack pointer + stack (16 levels)
    this.sp = 0;
    this.stack = new Uint16Array(16);

    // Timers (count down at 60Hz)
    this.delayTimer = 0;
    this.soundTimer = 0;

    // Display: 64x32 monochrome
    this.display = new Uint8Array(64 * 32);
    this.drawFlag = false;

    // Keyboard: 16 keys (0x0-0xF)
    this.keys = new Uint8Array(16);

    // Waiting for key press (Fx0A)
    this.waitingForKey = false;
    this.waitKeyReg = 0;

    // Running state
    this.halted = false;
  }

  // Load ROM into memory starting at 0x200
  loadROM(rom) {
    if (rom.length > 4096 - 0x200) {
      throw new Error(`ROM too large: ${rom.length} bytes (max ${4096 - 0x200})`);
    }
    this.memory.set(rom, 0x200);
  }

  // Press/release key (0-15)
  keyDown(key) {
    this.keys[key & 0xF] = 1;
    if (this.waitingForKey) {
      this.V[this.waitKeyReg] = key & 0xF;
      this.waitingForKey = false;
    }
  }

  keyUp(key) {
    this.keys[key & 0xF] = 0;
  }

  // Update timers (call at 60Hz)
  updateTimers() {
    if (this.delayTimer > 0) this.delayTimer--;
    if (this.soundTimer > 0) this.soundTimer--;
  }

  // Execute one cycle (fetch, decode, execute)
  cycle() {
    if (this.halted || this.waitingForKey) return;

    // Fetch opcode (2 bytes, big-endian)
    const opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
    this.pc += 2;

    // Decode
    const nnn = opcode & 0x0FFF;        // 12-bit address
    const nn = opcode & 0x00FF;          // 8-bit constant
    const n = opcode & 0x000F;           // 4-bit constant
    const x = (opcode >> 8) & 0x0F;      // 4-bit register index
    const y = (opcode >> 4) & 0x0F;      // 4-bit register index

    switch (opcode & 0xF000) {
      case 0x0000:
        if (opcode === 0x00E0) {
          // 00E0: CLS — clear display
          this.display.fill(0);
          this.drawFlag = true;
        } else if (opcode === 0x00EE) {
          // 00EE: RET — return from subroutine
          this.sp--;
          this.pc = this.stack[this.sp];
        }
        break;

      case 0x1000:
        // 1nnn: JP addr — jump to nnn
        this.pc = nnn;
        break;

      case 0x2000:
        // 2nnn: CALL addr — call subroutine at nnn
        this.stack[this.sp] = this.pc;
        this.sp++;
        this.pc = nnn;
        break;

      case 0x3000:
        // 3xnn: SE Vx, byte — skip if Vx == nn
        if (this.V[x] === nn) this.pc += 2;
        break;

      case 0x4000:
        // 4xnn: SNE Vx, byte — skip if Vx != nn
        if (this.V[x] !== nn) this.pc += 2;
        break;

      case 0x5000:
        // 5xy0: SE Vx, Vy — skip if Vx == Vy
        if (this.V[x] === this.V[y]) this.pc += 2;
        break;

      case 0x6000:
        // 6xnn: LD Vx, byte — set Vx = nn
        this.V[x] = nn;
        break;

      case 0x7000:
        // 7xnn: ADD Vx, byte — set Vx = Vx + nn
        this.V[x] = (this.V[x] + nn) & 0xFF;
        break;

      case 0x8000:
        switch (n) {
          case 0x0: this.V[x] = this.V[y]; break;                              // LD Vx, Vy
          case 0x1: this.V[x] |= this.V[y]; this.V[0xF] = 0; break;           // OR Vx, Vy
          case 0x2: this.V[x] &= this.V[y]; this.V[0xF] = 0; break;           // AND Vx, Vy
          case 0x3: this.V[x] ^= this.V[y]; this.V[0xF] = 0; break;           // XOR Vx, Vy
          case 0x4: {                                                            // ADD Vx, Vy
            const sum = this.V[x] + this.V[y];
            this.V[x] = sum & 0xFF;
            this.V[0xF] = sum > 0xFF ? 1 : 0;
            break;
          }
          case 0x5: {                                                            // SUB Vx, Vy
            const vf = this.V[x] >= this.V[y] ? 1 : 0;
            this.V[x] = (this.V[x] - this.V[y]) & 0xFF;
            this.V[0xF] = vf;
            break;
          }
          case 0x6: {                                                            // SHR Vx {, Vy}
            const vf = this.V[y] & 0x1;
            this.V[x] = this.V[y] >> 1;
            this.V[0xF] = vf;
            break;
          }
          case 0x7: {                                                            // SUBN Vx, Vy
            const vf = this.V[y] >= this.V[x] ? 1 : 0;
            this.V[x] = (this.V[y] - this.V[x]) & 0xFF;
            this.V[0xF] = vf;
            break;
          }
          case 0xE: {                                                            // SHL Vx {, Vy}
            const vf = (this.V[y] >> 7) & 0x1;
            this.V[x] = (this.V[y] << 1) & 0xFF;
            this.V[0xF] = vf;
            break;
          }
        }
        break;

      case 0x9000:
        // 9xy0: SNE Vx, Vy — skip if Vx != Vy
        if (this.V[x] !== this.V[y]) this.pc += 2;
        break;

      case 0xA000:
        // Annn: LD I, addr — set I = nnn
        this.I = nnn;
        break;

      case 0xB000:
        // Bnnn: JP V0, addr — jump to nnn + V0
        this.pc = (nnn + this.V[0]) & 0xFFF;
        break;

      case 0xC000:
        // Cxnn: RND Vx, byte — set Vx = random & nn
        this.V[x] = Math.floor(Math.random() * 256) & nn;
        break;

      case 0xD000: {
        // Dxyn: DRW Vx, Vy, n — draw sprite at (Vx, Vy), n bytes tall
        const xPos = this.V[x] % 64;
        const yPos = this.V[y] % 32;
        this.V[0xF] = 0;

        for (let row = 0; row < n; row++) {
          if (yPos + row >= 32) break;
          const spriteByte = this.memory[this.I + row];
          for (let col = 0; col < 8; col++) {
            if (xPos + col >= 64) break;
            if (spriteByte & (0x80 >> col)) {
              const idx = (yPos + row) * 64 + (xPos + col);
              if (this.display[idx]) this.V[0xF] = 1;
              this.display[idx] ^= 1;
            }
          }
        }
        this.drawFlag = true;
        break;
      }

      case 0xE000:
        if (nn === 0x9E) {
          // Ex9E: SKP Vx — skip if key Vx is pressed
          if (this.keys[this.V[x]]) this.pc += 2;
        } else if (nn === 0xA1) {
          // ExA1: SKNP Vx — skip if key Vx is NOT pressed
          if (!this.keys[this.V[x]]) this.pc += 2;
        }
        break;

      case 0xF000:
        switch (nn) {
          case 0x07: this.V[x] = this.delayTimer; break;                       // Fx07: LD Vx, DT
          case 0x0A:                                                             // Fx0A: LD Vx, K (wait for key)
            this.waitingForKey = true;
            this.waitKeyReg = x;
            break;
          case 0x15: this.delayTimer = this.V[x]; break;                        // Fx15: LD DT, Vx
          case 0x18: this.soundTimer = this.V[x]; break;                        // Fx18: LD ST, Vx
          case 0x1E: this.I = (this.I + this.V[x]) & 0xFFF; break;            // Fx1E: ADD I, Vx
          case 0x29: this.I = 0x050 + (this.V[x] & 0xF) * 5; break;           // Fx29: LD F, Vx (font)
          case 0x33: {                                                           // Fx33: LD B, Vx (BCD)
            const val = this.V[x];
            this.memory[this.I] = Math.floor(val / 100);
            this.memory[this.I + 1] = Math.floor((val % 100) / 10);
            this.memory[this.I + 2] = val % 10;
            break;
          }
          case 0x55:                                                             // Fx55: LD [I], Vx (store V0-Vx)
            for (let i = 0; i <= x; i++) this.memory[this.I + i] = this.V[i];
            this.I = (this.I + x + 1) & 0xFFF;
            break;
          case 0x65:                                                             // Fx65: LD Vx, [I] (load V0-Vx)
            for (let i = 0; i <= x; i++) this.V[i] = this.memory[this.I + i];
            this.I = (this.I + x + 1) & 0xFFF;
            break;
        }
        break;
    }
  }

  // Disassemble opcode at given address
  static disassemble(opcode) {
    const nnn = opcode & 0x0FFF;
    const nn = opcode & 0x00FF;
    const n = opcode & 0x000F;
    const x = (opcode >> 8) & 0x0F;
    const y = (opcode >> 4) & 0x0F;

    switch (opcode & 0xF000) {
      case 0x0000:
        if (opcode === 0x00E0) return 'CLS';
        if (opcode === 0x00EE) return 'RET';
        return `SYS ${nnn.toString(16).padStart(3, '0')}`;
      case 0x1000: return `JP ${nnn.toString(16).padStart(3, '0')}`;
      case 0x2000: return `CALL ${nnn.toString(16).padStart(3, '0')}`;
      case 0x3000: return `SE V${x.toString(16)}, ${nn}`;
      case 0x4000: return `SNE V${x.toString(16)}, ${nn}`;
      case 0x5000: return `SE V${x.toString(16)}, V${y.toString(16)}`;
      case 0x6000: return `LD V${x.toString(16)}, ${nn}`;
      case 0x7000: return `ADD V${x.toString(16)}, ${nn}`;
      case 0x8000: {
        const ops = { 0: 'LD', 1: 'OR', 2: 'AND', 3: 'XOR', 4: 'ADD', 5: 'SUB', 6: 'SHR', 7: 'SUBN', 0xE: 'SHL' };
        return `${ops[n] || '???'} V${x.toString(16)}, V${y.toString(16)}`;
      }
      case 0x9000: return `SNE V${x.toString(16)}, V${y.toString(16)}`;
      case 0xA000: return `LD I, ${nnn.toString(16).padStart(3, '0')}`;
      case 0xB000: return `JP V0, ${nnn.toString(16).padStart(3, '0')}`;
      case 0xC000: return `RND V${x.toString(16)}, ${nn}`;
      case 0xD000: return `DRW V${x.toString(16)}, V${y.toString(16)}, ${n}`;
      case 0xE000:
        if (nn === 0x9E) return `SKP V${x.toString(16)}`;
        if (nn === 0xA1) return `SKNP V${x.toString(16)}`;
        return `??? E${opcode.toString(16)}`;
      case 0xF000: {
        const fops = { 0x07: 'LD Vx, DT', 0x0A: 'LD Vx, K', 0x15: 'LD DT, Vx', 0x18: 'LD ST, Vx',
          0x1E: 'ADD I, Vx', 0x29: 'LD F, Vx', 0x33: 'LD B, Vx', 0x55: 'LD [I], Vx', 0x65: 'LD Vx, [I]' };
        return (fops[nn] || `??? F${nn.toString(16)}`).replace('Vx', `V${x.toString(16)}`);
      }
      default: return `??? ${opcode.toString(16).padStart(4, '0')}`;
    }
  }
}
