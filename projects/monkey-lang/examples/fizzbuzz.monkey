// FizzBuzz with template literals and for-loops

for (let i = 1; i < 101; i += 1) {
  if (i % 15 == 0) {
    puts("FizzBuzz");
  } else {
    if (i % 3 == 0) {
      puts("Fizz");
    } else {
      if (i % 5 == 0) {
        puts("Buzz");
      } else {
        puts(str(i));
      }
    }
  }
}
