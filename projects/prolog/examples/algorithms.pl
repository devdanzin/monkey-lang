% Classic algorithms in Prolog

% Fibonacci
fib(0, 0).
fib(1, 1).
fib(N, F) :- N > 1, N1 is N - 1, N2 is N - 2, fib(N1, F1), fib(N2, F2), F is F1 + F2.

% Factorial
fact(0, 1).
fact(N, F) :- N > 0, N1 is N - 1, fact(N1, F1), F is N * F1.

% GCD
gcd(X, 0, X) :- X > 0.
gcd(X, Y, G) :- Y > 0, R is X mod Y, gcd(Y, R, G).

% Quicksort
qsort([], []).
qsort([H|T], Sorted) :-
  partition(H, T, Less, Greater),
  qsort(Less, SortedLess),
  qsort(Greater, SortedGreater),
  append(SortedLess, [H|SortedGreater], Sorted).

partition(_, [], [], []).
partition(Pivot, [H|T], [H|Less], Greater) :-
  H =< Pivot, partition(Pivot, T, Less, Greater).
partition(Pivot, [H|T], Less, [H|Greater]) :-
  H > Pivot, partition(Pivot, T, Less, Greater).

% Tower of Hanoi
hanoi(1, From, To, _) :- 
  write(From), write(' -> '), writeln(To).
hanoi(N, From, To, Via) :-
  N > 1, N1 is N - 1,
  hanoi(N1, From, Via, To),
  write(From), write(' -> '), writeln(To),
  hanoi(N1, Via, To, From).

% Queries
?- fib(10, F).
?- fact(6, F).
?- gcd(12, 8, G).
?- qsort([3, 1, 4, 1, 5, 9, 2, 6], S).
