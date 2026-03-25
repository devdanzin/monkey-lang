// String Processing — demonstrates string builtins
// split, join, trim, replace, substr, str_contains

let sentence = "  Hello, World! This is Monkey Lang.  ";
puts("Original: '" + sentence + "'");
puts("Trimmed:  '" + trim(sentence) + "'");

let words = split(trim(sentence), " ");
puts("Words: " + str(len(words)));

let joined = join(words, " | ");
puts("Joined: " + joined);

let replaced = replace("Hello World Hello", "Hello", "Goodbye");
puts("Replaced: " + replaced);

let sub = substr("Monkey Language", 7);
puts("Substr from 7: " + sub);

let has = str_contains("Monkey Language", "key");
puts("Contains 'key': " + str(has));

// Type conversions
puts("int('42') = " + str(int("42")));
puts("str(42) = " + str(42));
puts("type(42) = " + type(42));
puts("type('hello') = " + type("hello"));
puts("type([1,2,3]) = " + type([1,2,3]));
