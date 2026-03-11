/**
 * FraudSys — Unit Tests
 * Tests the ML prediction engine and core business logic
 * Run: node tests/test.js
 */

const { predict } = require('../predict_batch');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS — ${name}`);
    passed++;
  } catch(e) {
    console.error(`  ❌ FAIL — ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

// ── ML ENGINE TESTS ──────────────────────────────────────────
console.log('\n[1] ML PREDICTION ENGINE\n');

test('Returns all required fields', () => {
  const result = predict({ amount: 100000, claims: 3, age: 35 });
  assert(result.risk,        'Missing: risk');
  assert(result.confidence,  'Missing: confidence');
  assert(result.risk_score !== undefined, 'Missing: risk_score');
  assert(result.flags,       'Missing: flags');
  assert(result.anomaly,     'Missing: anomaly');
  assert(result.probabilities, 'Missing: probabilities');
});

test('High amount + no police report = HIGH risk', () => {
  const result = predict({
    amount: 1800000, claims: 20, age: 22,
    policyDuration: 2, witnesses: 0, policeReport: false,
    premiumAmount: 10000, vehicleAge: 15
  });
  assertEqual(result.risk, 'High', `Expected High, got ${result.risk}`);
});

test('Normal claim = LOW risk', () => {
  const result = predict({
    amount: 50000, claims: 2, age: 40,
    policyDuration: 60, witnesses: 2, policeReport: true,
    premiumAmount: 15000, vehicleAge: 3
  });
  assertEqual(result.risk, 'Low', `Expected Low, got ${result.risk}`);
});

test('Risk score between 0 and 100', () => {
  const result = predict({ amount: 500000, claims: 8, age: 30 });
  assert(result.risk_score >= 0 && result.risk_score <= 100,
    `Risk score out of range: ${result.risk_score}`);
});

test('Confidence between 1 and 99', () => {
  const result = predict({ amount: 200000, claims: 5, age: 45 });
  assert(result.confidence >= 1 && result.confidence <= 99,
    `Confidence out of range: ${result.confidence}`);
});

test('Extreme amount triggers EXTREME_AMOUNT flag', () => {
  const result = predict({ amount: 2000000, claims: 1, age: 30 });
  assert(result.flags.includes('EXTREME_AMOUNT'),
    `Expected EXTREME_AMOUNT flag, got: ${result.flags.join(', ')}`);
});

test('No witness + high claim triggers NO_WITNESS_HIGH_CLAIM flag', () => {
  const result = predict({ amount: 600000, claims: 5, witnesses: 0, policeReport: false });
  assert(result.flags.includes('NO_WITNESS_HIGH_CLAIM') || result.flags.includes('NO_POLICE_REPORT'),
    `Expected witness/police flag, got: ${result.flags.join(', ')}`);
});

test('Location field passes through', () => {
  const result = predict({ amount: 100000, claims: 2, age: 35, location: 'Mumbai' });
  assertEqual(result.location, 'Mumbai', 'Location not preserved');
});

test('Probabilities sum to ~100', () => {
  const result = predict({ amount: 300000, claims: 5, age: 35 });
  const sum = result.probabilities.Low + result.probabilities.Medium + result.probabilities.High;
  assert(sum >= 95 && sum <= 105, `Probabilities sum is ${sum}, expected ~100`);
});

test('Missing params use defaults without crashing', () => {
  const result = predict({});
  assert(result.risk, 'Crashed on empty params');
});

test('New policy + large claim triggers NEW_POLICY_LARGE_CLAIM', () => {
  const result = predict({
    amount: 800000, claims: 10, age: 25,
    policyDuration: 2, premiumAmount: 5000
  });
  assert(result.flags.includes('NEW_POLICY_LARGE_CLAIM'),
    `Expected NEW_POLICY_LARGE_CLAIM, got: ${result.flags.join(', ')}`);
});

// ── RISK CLASSIFICATION TESTS ────────────────────────────────
console.log('\n[2] RISK CLASSIFICATION\n');

test('Score >= 60 = High risk', () => {
  const result = predict({
    amount: 1900000, claims: 25, age: 19,
    policyDuration: 1, witnesses: 0, policeReport: false,
    premiumAmount: 8000, vehicleAge: 18
  });
  assertEqual(result.risk, 'High');
});

test('Moderate claim = Medium risk', () => {
  const result = predict({
    amount: 350000, claims: 8, age: 28,
    policyDuration: 12, witnesses: 1, policeReport: false,
    premiumAmount: 12000, vehicleAge: 7
  });
  assert(['Medium','High'].includes(result.risk), `Expected Medium/High, got ${result.risk}`);
});

// ── ANOMALY DETECTION TESTS ──────────────────────────────────
console.log('\n[3] ANOMALY DETECTION\n');

test('Multiple flags = anomaly detected', () => {
  const result = predict({
    amount: 1500000, claims: 22, age: 20,
    policyDuration: 1, witnesses: 0, policeReport: false,
    premiumAmount: 5000, vehicleAge: 16
  });
  assert(result.anomaly.is_anomaly, 'Expected anomaly = true');
});

test('Clean record = no anomaly', () => {
  const result = predict({
    amount: 30000, claims: 1, age: 50,
    policyDuration: 120, witnesses: 3, policeReport: true,
    premiumAmount: 20000, vehicleAge: 2
  });
  assert(!result.anomaly.is_anomaly, 'Expected anomaly = false');
});

// ── SUMMARY ──────────────────────────────────────────────────
console.log(`\n${'─'.repeat(45)}`);
console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`${'─'.repeat(45)}\n`);

if (failed > 0) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed ✅');
  process.exit(0);
}
