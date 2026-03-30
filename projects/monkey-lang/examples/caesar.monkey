// Caesar Cipher in WebAssembly
// Encrypts and decrypts text by shifting characters

let encrypt = fn(text, shift) {
  let result = "";
  for (ch in text) {
    // Simple shift on lowercase letters a-z (ASCII 97-122)
    // For now, just shift and wrap
    result = result + ch;  // TODO: actual shifting needs char codes
  }
  result
};

// Since we don't have char→int conversion yet, demonstrate with array encoding
let alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m",
                "n","o","p","q","r","s","t","u","v","w","x","y","z"];

let findIndex = fn(arr, target) {
  for (i in 0..len(arr)) {
    if (arr[i] == target) { return i; }
  }
  -1
};

let caesarEncrypt = fn(text, shift) {
  let result = "";
  for (ch in text) {
    let idx = findIndex(alphabet, ch);
    if (idx >= 0) {
      let newIdx = (idx + shift) % 26;
      result = result + alphabet[newIdx];
    } else {
      result = result + ch;
    }
  }
  result
};

let caesarDecrypt = fn(text, shift) {
  let result = "";
  for (ch in text) {
    let idx = findIndex(alphabet, ch);
    if (idx >= 0) {
      let newIdx = (idx + 26 - shift) % 26;
      result = result + alphabet[newIdx];
    } else {
      result = result + ch;
    }
  }
  result
};

// Demo
let message = "hello world";
let shift = 13;  // ROT13

puts("Original:  " + message);
let encrypted = caesarEncrypt(message, shift);
puts("Encrypted: " + encrypted);
let decrypted = caesarDecrypt(encrypted, shift);
puts("Decrypted: " + decrypted);

puts("");

// ROT13 is its own inverse!
puts("ROT13 of 'monkey': " + caesarEncrypt("monkey", 13));
puts("ROT13 again:       " + caesarEncrypt(caesarEncrypt("monkey", 13), 13));
