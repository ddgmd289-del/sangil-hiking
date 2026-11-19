// Execute the actual GPS backup recovery function against deterministic tracks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function recoverNativeGps(){');
const end = html.indexOf('function refreshGpsDiagnostics(){', start);
assert.ok(start >= 0 && end > start, 'recovery implementation must be present');
const source = html.slice(start, end);
const base = Date.now() - 120000;
function point(n, t, extra={}) {
  return {lat:37, lon:127+n*.0001, accuracy:5, t:base+t*1000, ...extra};
}
function run({live=[], backup=[], distance=0, rests=[], restStarted=0}) {
  const trip = {started:base, state:'active', activity:'걷기', points:live, distance, rests, restStarted};
  const sandbox = {
    trip, window:{SangilNative:{getTrackBackup:()=>backup.map(p=>JSON.stringify({
      lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t,alt:0
    })).join('\n')}},
    km:(a,b)=>Math.abs(a.lon-b.lon)*88.8, // km per longitude degree at latitude 37
    persist:()=>{},updateStats:()=>{},draw:()=>{},console,Date,Number,Math,Set,JSON,Array
  };
  vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox);
  return trip;
}
const a=point(0,0), b=point(1,10), c=point(2,20);
let result=run({live:[a,c],backup:[a,b,c],distance:.05});
assert.equal(result.points.length,3,'missing native fix must be restored');
assert.ok(result.distance>=.05,'recovery must not reduce recorded distance');
result=run({live:[a],backup:[a,b],distance:3.1});
assert.equal(result.points.length,2);
assert.equal(result.distance,3.1,'longer live distance must survive backup');
result=run({live:[a],backup:[b],rests:[{started:base+5000,ended:base+15000}]});
assert.equal(result.points.length,1,'explicitly paused fix must not be recovered');
result=run({live:[a],backup:[{...b,lat:91}]});
assert.equal(result.points.length,1,'invalid latitude must be rejected');
console.log('Native GPS recovery executable regression: PASS');
