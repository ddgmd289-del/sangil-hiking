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
// Keep the full 301-point, 50-minute replay in the past; future fixes are correctly rejected.
const base = Date.now() - 3600000;
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
result=run({live:[a],backup:[b],rests:[{type:'manual',started:base+5000,ended:base+15000}]});
assert.equal(result.points.length,1,'manually paused fix must not be recovered');
result=run({live:[a],backup:[{...b,lat:91}]});
assert.equal(result.points.length,1,'invalid latitude must be rejected');
// A backup longer than the historical 250-fix limit must be fully replayed.
const longTrack=Array.from({length:301},(_,i)=>point(i,i*10));
result=run({backup:longTrack});
assert.equal(result.points.length,301,'all 301 native fixes must be restored');
assert.ok(result.distance>2.5,'long recovered track must contribute distance');
// A native intermediate fix must repair a stale gap without shrinking the live total.
result=run({live:[{...a},{...c,breakBefore:true}],backup:[b],distance:.001});
assert.equal(result.points.length,3,'intermediate native fix must be merged');
assert.equal(result.points[2].breakBefore,false,'reliable intermediate fix should bridge stale gap');
assert.ok(result.distance>.001,'bridged segments must restore measured distance');
// Reject future timestamps, preserving only the valid live route.
result=run({live:[a],backup:[{...b,t:Date.now()+60000}]});
assert.equal(result.points.length,1,'future native fixes must be rejected');
console.log('Native GPS recovery executable regression: PASS');
