// Tiny ELF parser — read ELF headers from binary data

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7fELF

const EI_CLASS = { 1: 'ELF32', 2: 'ELF64' };
const EI_DATA = { 1: 'little-endian', 2: 'big-endian' };
const ET_TYPE = { 0: 'NONE', 1: 'REL', 2: 'EXEC', 3: 'DYN', 4: 'CORE' };
const EM_MACHINE = {
  0: 'NONE', 3: 'x86', 8: 'MIPS', 20: 'PowerPC', 40: 'ARM',
  62: 'x86-64', 183: 'AArch64', 243: 'RISC-V'
};

export function parseELF(buffer) {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (data.length < 64) throw new Error('Too small to be an ELF file');

  // Check magic
  for (let i = 0; i < 4; i++) {
    if (data[i] !== ELF_MAGIC[i]) throw new Error('Not an ELF file (bad magic)');
  }

  const eiClass = data[4];
  const eiData = data[5];
  const is64 = eiClass === 2;
  const isLE = eiData === 1;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (off) => view.getUint16(off, isLE);
  const u32 = (off) => view.getUint32(off, isLE);
  const u64 = (off) => {
    if (isLE) return view.getUint32(off, true) + view.getUint32(off + 4, true) * 0x100000000;
    return view.getUint32(off, false) * 0x100000000 + view.getUint32(off + 4, false);
  };

  const header = {
    class: EI_CLASS[eiClass] || 'unknown',
    encoding: EI_DATA[eiData] || 'unknown',
    version: data[6],
    osabi: data[7],
    type: ET_TYPE[u16(16)] || `unknown(${u16(16)})`,
    machine: EM_MACHINE[u16(18)] || `unknown(${u16(18)})`,
    entryPoint: is64 ? u64(24) : u32(24),
    phoff: is64 ? u64(32) : u32(28),
    shoff: is64 ? u64(40) : u32(32),
    phnum: is64 ? u16(56) : u16(44),
    shnum: is64 ? u16(60) : u16(48),
    shstrndx: is64 ? u16(62) : u16(50),
  };

  // Parse section headers
  const sections = [];
  const shentsize = is64 ? 64 : 40;
  for (let i = 0; i < header.shnum; i++) {
    const off = header.shoff + i * shentsize;
    if (off + shentsize > data.length) break;
    sections.push({
      nameOffset: u32(off),
      type: u32(off + 4),
      addr: is64 ? u64(off + 16) : u32(off + 12),
      offset: is64 ? u64(off + 24) : u32(off + 16),
      size: is64 ? u64(off + 32) : u32(off + 20),
    });
  }

  // Resolve section names from shstrtab
  if (header.shstrndx < sections.length) {
    const strtab = sections[header.shstrndx];
    for (const s of sections) {
      const nameStart = strtab.offset + s.nameOffset;
      let name = '';
      for (let i = nameStart; i < data.length && data[i] !== 0; i++) name += String.fromCharCode(data[i]);
      s.name = name;
    }
  }

  // Parse program headers
  const segments = [];
  const phentsize = is64 ? 56 : 32;
  const PT_TYPE = { 0: 'NULL', 1: 'LOAD', 2: 'DYNAMIC', 3: 'INTERP', 4: 'NOTE', 6: 'PHDR' };
  for (let i = 0; i < header.phnum; i++) {
    const off = header.phoff + i * phentsize;
    if (off + phentsize > data.length) break;
    segments.push({
      type: PT_TYPE[u32(off)] || `unknown(${u32(off)})`,
      offset: is64 ? u64(off + 8) : u32(off + 4),
      vaddr: is64 ? u64(off + 16) : u32(off + 8),
      fileSize: is64 ? u64(off + 32) : u32(off + 16),
      memSize: is64 ? u64(off + 40) : u32(off + 20),
    });
  }

  return { header, sections, segments };
}

export function isELF(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
}
