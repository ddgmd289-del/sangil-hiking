// Regression guard: native GPS geometry recovery must never reduce a longer live distance.
// Run: node tests/gps-recovery-distance-preservation.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = source.indexOf('function recoverNativeGps(){');
const end = source.indexOf('function refreshGpsDiagnostics(){', start);
assert.ok(start >= 0 && end > start, 'GPS recovery function must exist');
const recovery = source.slice(start, end);
assert.match(recovery, /trip\.distance\s*=\s*Math\.max\(trip\.distance\s*\|\|\s*0\s*,\s*total\)/,
  'Recovered track must retain the longer existing distance');
assert.doesNotMatch(recovery, /if\s*\(total\s*\+\s*0\.001\s*<\s*trip\.distance\)\s*return/,
  'A shorter backup distance must not discard recovered route geometry');
assert.match(recovery, /filtered\.length\s*>\s*\(trip\.points\s*\|\|\s*\[\]\)\.length/,
  'Recovery must be allowed to add previously missing points');
for (const [live, backup, expected] of [[3.1, 1.33, 3.1], [1.33, 3.1, 3.1], [0, 0, 0]]) {
  assert.equal(Math.max(live || 0, backup), expected);
}
// Auto-pause can be a false positive while walking. Its native fixes must remain
// eligible for replay; explicit manual pauses must remain excluded.
assert.match(recovery, /r\.type==='manual'&&Number\.isFinite\(Number\(r\.started\)\)/,
  'Recovery must distinguish manual rest from automatic pause');
assert.match(recovery, /trip\.pauseReason==='manual'&&trip\.restStarted/,
  'Active manual rest must still block native replay');
assert.doesNotMatch(recovery, /\(trip\.restStarted&&fix\.t>=trip\.restStarted\)/,
  'Automatic pause must not silently discard backup fixes');
console.log('GPS geometry recovery distance-preservation and auto-pause replay guards: PASS');
