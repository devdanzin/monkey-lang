// Color utilities — conversion, manipulation, palette generation

export class Color {
  constructor(r, g, b, a = 1) {
    this.r = Math.round(Math.max(0, Math.min(255, r)));
    this.g = Math.round(Math.max(0, Math.min(255, g)));
    this.b = Math.round(Math.max(0, Math.min(255, b)));
    this.a = Math.max(0, Math.min(1, a));
  }

  // ===== Conversion =====
  toHex() {
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${this.a < 1 ? hex(Math.round(this.a * 255)) : ''}`;
  }

  toRgb() { return `rgb(${this.r}, ${this.g}, ${this.b})`; }
  toRgba() { return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`; }

  toHsl() {
    const r = this.r / 255, g = this.g / 255, b = this.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  toArray() { return [this.r, this.g, this.b, this.a]; }
  toString() { return this.a < 1 ? this.toRgba() : this.toHex(); }

  // ===== Manipulation =====
  lighten(amount) { const { h, s, l } = this.toHsl(); return Color.fromHsl(h, s, Math.min(100, l + amount)); }
  darken(amount) { const { h, s, l } = this.toHsl(); return Color.fromHsl(h, s, Math.max(0, l - amount)); }
  saturate(amount) { const { h, s, l } = this.toHsl(); return Color.fromHsl(h, Math.min(100, s + amount), l); }
  desaturate(amount) { const { h, s, l } = this.toHsl(); return Color.fromHsl(h, Math.max(0, s - amount), l); }
  rotate(degrees) { const { h, s, l } = this.toHsl(); return Color.fromHsl((h + degrees + 360) % 360, s, l); }
  invert() { return new Color(255 - this.r, 255 - this.g, 255 - this.b, this.a); }
  grayscale() { const avg = Math.round(0.299 * this.r + 0.587 * this.g + 0.114 * this.b); return new Color(avg, avg, avg, this.a); }
  opacity(a) { return new Color(this.r, this.g, this.b, a); }

  // Contrast ratio (WCAG)
  luminance() {
    const [r, g, b] = [this.r, this.g, this.b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  contrastRatio(other) {
    const l1 = Math.max(this.luminance(), other.luminance());
    const l2 = Math.min(this.luminance(), other.luminance());
    return (l1 + 0.05) / (l2 + 0.05);
  }

  isLight() { return this.luminance() > 0.5; }
  isDark() { return !this.isLight(); }

  equals(other) { return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a; }

  // ===== Static constructors =====
  static fromHex(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return new Color(r, g, b, a);
  }

  static fromHsl(h, s, l, a = 1) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return new Color((r + m) * 255, (g + m) * 255, (b + m) * 255, a);
  }

  static random() { return new Color(Math.random() * 255, Math.random() * 255, Math.random() * 255); }

  // ===== Interpolation =====
  static lerp(c1, c2, t) {
    return new Color(
      c1.r + (c2.r - c1.r) * t,
      c1.g + (c2.g - c1.g) * t,
      c1.b + (c2.b - c1.b) * t,
      c1.a + (c2.a - c1.a) * t,
    );
  }

  // ===== Palette generation =====
  static complementary(color) { return [color, color.rotate(180)]; }
  static triadic(color) { return [color, color.rotate(120), color.rotate(240)]; }
  static analogous(color, angle = 30) { return [color.rotate(-angle), color, color.rotate(angle)]; }
  static splitComplementary(color) { return [color, color.rotate(150), color.rotate(210)]; }

  static gradient(c1, c2, steps) {
    return Array.from({ length: steps }, (_, i) => Color.lerp(c1, c2, i / (steps - 1)));
  }
}

// Named colors
Color.WHITE = new Color(255, 255, 255);
Color.BLACK = new Color(0, 0, 0);
Color.RED = new Color(255, 0, 0);
Color.GREEN = new Color(0, 128, 0);
Color.BLUE = new Color(0, 0, 255);
