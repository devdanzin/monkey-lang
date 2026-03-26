// Project Euler #1: Sum of all multiples of 3 or 5 below 1000
import "math" for abs;

let sum = 0;
for (let i = 1; i < 1000; i += 1) {
  if (i % 3 == 0 || i % 5 == 0) {
    sum += i;
  }
}
puts(sum) // 233168
