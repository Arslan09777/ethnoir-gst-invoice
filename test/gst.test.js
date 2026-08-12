const test = require('node:test');
const assert = require('node:assert/strict');

function calculateLine(inclusivePrice, discount = 0) {
  const net = inclusivePrice - discount;
  if (net > 2625 && net < 2950) return { reviewRequired: true };
  const rate = net <= 2625 ? .05 : .18;
  return { rate, taxable: net / (1 + rate) };
}

test('Rs. 2599 inclusive qualifies for 5% because taxable value is below Rs. 2500', () => {
  const line = calculateLine(2599);
  assert.equal(line.rate, .05);
  assert.equal(line.taxable.toFixed(2), '2475.24');
});
test('Rs. 2625 inclusive is the highest 5% price', () => assert.equal(calculateLine(2625).rate, .05));
test('Rs. 2,950 inclusive begins the 18% band', () => assert.equal(calculateLine(2950).rate, .18));
test('inclusive price in the slab gap requires review instead of a guessed rate', () => {
  assert.equal(calculateLine(2700).reviewRequired, true);
});

