// Error handling with Result types
import "math" for sqrt;

// Safe division returns Ok or Err
let safe_div = fn(a: int, b: int) {
  if (b == 0) { Err("division by zero") } 
  else { Ok(a / b) }
};

// Pattern match on results
let result = safe_div(10, 3);
match (result) {
  Ok(v) => puts("10 / 3 = " + str(v)),
  Err(e) => puts("Error: " + e)
};

// Chaining with unwrap_or
let values = [10, 0, 5, 0, 3];
for (v in values) {
  let r = safe_div(100, v).unwrap_or(-1);
  puts("100 / " + str(v) + " = " + str(r));
}
