// Tower of Hanoi
// Demonstrates: recursion, template literals, string multiplication

let hanoi = fn(n, from, to, via) {
  if (n == 0) { return null; }
  hanoi(n - 1, from, via, to);
  puts(`  Move disk ${n} from ${from} to ${to}`);
  hanoi(n - 1, via, to, from);
};

puts("Tower of Hanoi (4 disks):");
puts("-" * 30);
hanoi(4, "A", "C", "B");
puts(`\nTotal moves: ${2 * 2 * 2 * 2 - 1}`);
