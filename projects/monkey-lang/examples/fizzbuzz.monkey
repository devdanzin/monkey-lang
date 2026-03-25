// FizzBuzz — demonstrates modulo, nested conditionals, and string operations
// Also showcases the nested-if JIT fix!

let i = 1;
while (i < 101) {
  if (i % 15 == 0) {
    puts("FizzBuzz");
  }
  if (i % 15 != 0) {
    if (i % 3 == 0) {
      puts("Fizz");
    }
    if (i % 3 != 0) {
      if (i % 5 == 0) {
        puts("Buzz");
      }
      if (i % 5 != 0) {
        puts(str(i));
      }
    }
  }
  i = i + 1;
}
