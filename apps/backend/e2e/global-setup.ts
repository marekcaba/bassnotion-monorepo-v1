export async function setup() {
  // Add any global setup here (runs once before all test files)
  process.env['NODE_ENV'] = 'test';
}

export async function teardown() {
  // Add any global cleanup here (runs once after all test files)
}
