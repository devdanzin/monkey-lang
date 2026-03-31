// Color gradient — interpolate between colors
function parseHex(hex) { const h = hex.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function toHex(r, g, b) { return '#' + [r,g,b].map(c => Math.round(c).toString(16).padStart(2,'0')).join(''); }
function lerpC(a, b, t) { return a + (b - a) * t; }

export function gradient(colors, steps) {
  if (colors.length < 2) throw new Error('Need at least 2 colors');
  const result = [];
  const segments = colors.length - 1;
  const stepsPerSeg = Math.ceil(steps / segments);
  for (let i = 0; i < segments; i++) {
    const [r1,g1,b1] = parseHex(colors[i]);
    const [r2,g2,b2] = parseHex(colors[i+1]);
    const n = i === segments - 1 ? steps - result.length : stepsPerSeg;
    for (let j = 0; j < n; j++) {
      const t = n > 1 ? j / (n - 1) : 0;
      result.push(toHex(lerpC(r1,r2,t), lerpC(g1,g2,t), lerpC(b1,b2,t)));
    }
  }
  return result;
}

export function interpolate(color1, color2, t) {
  const [r1,g1,b1] = parseHex(color1);
  const [r2,g2,b2] = parseHex(color2);
  return toHex(lerpC(r1,r2,t), lerpC(g1,g2,t), lerpC(b1,b2,t));
}

export const presets = {
  rainbow: ['#ff0000','#ff7700','#ffff00','#00ff00','#0000ff','#8b00ff'],
  warm: ['#ff0000','#ff7700','#ffff00'],
  cool: ['#0000ff','#00ffff','#00ff00'],
  grayscale: ['#000000','#ffffff'],
};
