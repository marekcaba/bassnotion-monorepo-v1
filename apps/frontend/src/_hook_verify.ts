// Temporary file to verify pre-commit hook behavior.
// Contains all 4 disabled noisy rules. Should commit cleanly.
console.log('a console call: triggers no-console + no-restricted-syntax');

export function unused() {
  const unusedVar = 42; // triggers no-unused-vars
  unusedVar; // triggers no-unused-expressions
  return null;
}
