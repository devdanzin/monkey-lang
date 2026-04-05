// color.js — Color library

const NAMED = { red: '#ff0000', green: '#008000', blue: '#0000ff', white: '#ffffff', black: '#000000', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080' };

export class Color {
  constructor(r, g, b, a = 1) { this.r = Math.round(Math.min(255, Math.max(0, r))); this.g = Math.round(Math.min(255, Math.max(0, g))); this.b = Math.round(Math.min(255, Math.max(0, b))); this.a = Math.min(1, Math.max(0, a)); }

  static parse(str) {
    str = str.trim().toLowerCase();
    if (NAMED[str]) str = NAMED[str];
    
    // Hex
    if (str.startsWith('#')) {
      const hex = str.slice(1);
      if (hex.length === 3) return new Color(...[...hex].map(c => parseInt(c + c, 16)));
      if (hex.length === 6) return new Color(parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16));
      if (hex.length === 8) return new Color(parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16), parseInt(hex.slice(6,8),16)/255);
    }
    
    // rgb/rgba
    const rgbM = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(str);
    if (rgbM) return new Color(+rgbM[1], +rgbM[2], +rgbM[3], rgbM[4] != null ? +rgbM[4] : 1);
    
    // hsl/hsla
    const hslM = /hsla?\((\d+),\s*([\d.]+)%?,\s*([\d.]+)%?(?:,\s*([\d.]+))?\)/.exec(str);
    if (hslM) return Color.fromHSL(+hslM[1], +hslM[2], +hslM[3], hslM[4] != null ? +hslM[4] : 1);
    
    throw new Error(`Cannot parse: ${str}`);
  }

  static fromHSL(h, s, l, a = 1) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p + (q-p)*(2/3-t)*6; return p; };
      const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
      r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    return new Color(r*255, g*255, b*255, a);
  }

  toHex() { return '#' + [this.r,this.g,this.b].map(v => v.toString(16).padStart(2,'0')).join(''); }
  toRgb() { return this.a < 1 ? `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})` : `rgb(${this.r}, ${this.g}, ${this.b})`; }
  
  toHSL() {
    const r = this.r/255, g = this.g/255, b = this.b/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      if (max === r) h = ((g-b)/d + (g < b ? 6 : 0))/6;
      else if (max === g) h = ((b-r)/d+2)/6;
      else h = ((r-g)/d+4)/6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  lighten(amount) { const hsl = this.toHSL(); return Color.fromHSL(hsl.h, hsl.s, Math.min(100, hsl.l + amount), this.a); }
  darken(amount) { const hsl = this.toHSL(); return Color.fromHSL(hsl.h, hsl.s, Math.max(0, hsl.l - amount), this.a); }
  saturate(amount) { const hsl = this.toHSL(); return Color.fromHSL(hsl.h, Math.min(100, hsl.s + amount), hsl.l, this.a); }
  desaturate(amount) { const hsl = this.toHSL(); return Color.fromHSL(hsl.h, Math.max(0, hsl.s - amount), hsl.l, this.a); }
  grayscale() { const gray = Math.round(0.299*this.r + 0.587*this.g + 0.114*this.b); return new Color(gray, gray, gray, this.a); }
  invert() { return new Color(255 - this.r, 255 - this.g, 255 - this.b, this.a); }
  alpha(a) { return new Color(this.r, this.g, this.b, a); }

  mix(other, weight = 0.5) {
    return new Color(
      this.r * (1-weight) + other.r * weight,
      this.g * (1-weight) + other.g * weight,
      this.b * (1-weight) + other.b * weight,
      this.a * (1-weight) + other.a * weight,
    );
  }

  luminance() {
    const [r, g, b] = [this.r, this.g, this.b].map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  }

  contrastRatio(other) {
    const l1 = Math.max(this.luminance(), other.luminance());
    const l2 = Math.min(this.luminance(), other.luminance());
    return (l1 + 0.05) / (l2 + 0.05);
  }

  isAccessible(bg, level = 'AA') {
    const ratio = this.contrastRatio(bg);
    return level === 'AAA' ? ratio >= 7 : ratio >= 4.5;
  }

  complementary() { const hsl = this.toHSL(); return Color.fromHSL((hsl.h + 180) % 360, hsl.s, hsl.l); }
  triadic() { const hsl = this.toHSL(); return [Color.fromHSL((hsl.h + 120) % 360, hsl.s, hsl.l), Color.fromHSL((hsl.h + 240) % 360, hsl.s, hsl.l)]; }
  analogous() { const hsl = this.toHSL(); return [Color.fromHSL((hsl.h + 30) % 360, hsl.s, hsl.l), Color.fromHSL((hsl.h - 30 + 360) % 360, hsl.s, hsl.l)]; }

  equals(other) { return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a; }
}
