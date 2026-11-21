// Regression coverage for GPS backup gaps, malformed lines and duplicate replay.
// Uses the production recoverNativeGps implementation rather than a reimplementation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=html.indexOf('function recoverNativeGps(){');
const end=html.indexOf('function refreshGpsDiagnostics(){',begin);
assert.ok(begin>=0&&end>begin,'production recovery function is available');
const source=html.slice(begin,end);
const base=Date.now()-240000;
const fix=(n,sec)=>({lat:37,lon:127+n*.0001,accuracy:5,t:base+sec*1000});
function recover(points,backup,distance=0){
 const trip={started:base,state:'active',activity:'걷기',points,distance,rests:[],restStarted:0};
 const sandbox={trip,window:{SangilNative:{getTrackBackup:()=>backup}},km:(a,b)=>Math.abs(a.lon-b.lon)*88.8,persist(){},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
 vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox);
 return trip;
}
const encode=p=>JSON.stringify({lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t});
const a=fix(0,0),b=fix(1,10),c=fix(2,20);
let trip=recover([a],[encode(a),'not-json',encode(b),encode(b),encode(c)].join('\n'));
assert.equal(trip.points.length,3,'malformed and duplicated fixes must not lose valid fixes');
const before=trip.distance;
trip=recover(trip.points,[encode(a),encode(b),encode(c)].join('\n'),before);
assert.equal(trip.points.length,3,'replaying backup must not duplicate coordinates');
assert.equal(trip.distance,before,'replaying backup must not inflate distance');
const far=fix(100,200);
trip=recover([],[encode(a),encode(far)].join('\n'));
assert.equal(trip.points.length,2,'retain GPS points across a long signal outage');
assert.equal(trip.points[1].breakBefore,true,'do not draw an invented straight line over a long outage');
assert.equal(trip.distance,0,'do not count a disconnected jump as walked distance');
console.log('GPS recovery gap and replay regression: PASS');
