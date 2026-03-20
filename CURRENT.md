status: done
mode: BUILD
task: Fix recursive closure bug (OpCurrentClosure opcode)
context: Fixed by setting function literal name from let-binding before compilation. defineFunctionName creates FUNCTION-scoped symbol that shadows the LOCAL, so self-references emit OpCurrentClosure. 104 tests passing (2 new).
context-files: lessons/compiler-vm.md
est: 0
next: 11:15 EXPLORE — COGITATE consciousness experiment
updated: 2026-03-20T10:24:00-06:00
