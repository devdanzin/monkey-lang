// Cipher utilities — ROT13, Caesar, Vigenère, XOR
export function rot13(str) { return caesar(str, 13); }
export function caesar(str, shift) { return str.replace(/[a-zA-Z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + shift) % 26 + base); }); }
export function vigenere(str, key, decrypt = false) {
  let ki = 0;
  return str.replace(/[a-zA-Z]/g, c => {
    const base = c < 'a' ? 65 : 97;
    const k = key[ki % key.length].toUpperCase().charCodeAt(0) - 65;
    ki++;
    return String.fromCharCode((c.charCodeAt(0) - base + (decrypt ? 26 - k : k)) % 26 + base);
  });
}
export function xorCipher(str, key) { return str.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''); }
export function atbash(str) { return str.replace(/[a-zA-Z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base)); }); }
