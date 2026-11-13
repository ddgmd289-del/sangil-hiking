// Run: node tests/gps-filter.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
assert.equal((html.match(/window\.sangilNativeFix=function/g) || []).length, 1, 'Native GPS callback must be unique');
assert.match(html, /const plausibleSpeed=dt>0&&diff\/dt<=\.008;/);
assert.match(html, /const usableFix=cur\.accuracy<=65&&\(!prev\|\|\(plausibleSpeed&&diff>=noiseKm\)\);/);
const accepted = ({accuracy, dt, diff, noiseKm=0.002, first=false}) =>
  accuracy <= 65 && (first || (dt > 0 && diff/dt <= 0.008 && diff >= noiseKm));
assert.equal(accepted({accuracy:12,dt:5,diff:0.008}), true, 'Normal walking fix');
assert.equal(accepted({accuracy:90,dt:5,diff:0.008}), false, 'Low quality fix');
assert.equal(accepted({accuracy:10,dt:0,diff:0.01}), false, 'Duplicate-time fix');
assert.equal(accepted({accuracy:10,dt:1,diff:0.1}), false, 'GPS teleport');
assert.equal(accepted({accuracy:10,dt:5,diff:0.0005}), false, 'Stationary jitter');
assert.equal(accepted({accuracy:10,dt:0,diff:0,first:true}), true, 'First fix');
console.log('GPS filter static and scenario checks passed');
