// String manipulation showcase
import "string" for upper, lower, reverse, padLeft, repeat;

let banner = repeat("=", 30);
puts(banner);
puts(padLeft("Monkey Lang", 20, " "));
puts(banner);

let word = "racecar";
puts(word + " reversed is " + reverse(word));
puts("Is palindrome? " + str(word == reverse(word)));

puts(upper("hello, world!"));
puts(lower("WHISPER"));
