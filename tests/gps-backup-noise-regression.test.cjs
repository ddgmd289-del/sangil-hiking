// Production GPS recovery must filter newly recovered jitter/spikes, not saved live fixes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const begin=html.indexOf('function recoverNativeGps(){');
const end=html.indexOf('function refreshGpsDiagnostics(){',begin);
assert.ok(begin>=0&&end>begin);
const source=html.slice(begin,end);
const base=Date.now()-120000;
const fix=(n,t)=>({lat:37,lon:127+n*.0001,accuracy:5,t:base+t*1000});
function run(live,backup,rejectedGpsFixes=[]){
 const trip={started:base,state:'running',activity:'걷기',points:live,distance:0,rests:[],rejectedGpsFixes};
 const sandbox={trip,window:{SangilNative:{getTrackBackup:()=>backup.map(p=>JSON.stringify({lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t})).join('\n')}},km:(a,b)=>Math.abs(a.lon-b.lon)*88.8,persist(){},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
 vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox);
 return trip;
}
const a=fix(0,0),b=fix(1,10),c=fix(2,20);
let trip=run([a,c],[b]);
assert.equal(trip.points.length,3,'valid intermediate backup fix must survive');
const jitter={...fix(0,5),lon:a.lon+.000005};
trip=run([a,c],[jitter,b]);
assert.equal(trip.points.length,3,'sub-3m recovered jitter must not be inserted');
const spike={...fix(100,5)};
trip=run([a,c],[spike,b]);
assert.equal(trip.points.length,3,'impossible-speed recovered spike must be rejected');
trip=run([a,{...jitter,t:base+5000},c],[b]);
assert.equal(trip.points.length,4,'existing live fixes must be preserved even if close together');
console.log('GPS backup jitter and spike regression: PASS');

// A previously removed plausible-speed detour must not return on backup replay.
const rejected=fix(1,10);
const later=fix(3,30);
const key=rejected.t+':'+rejected.lat+':'+rejected.lon;
trip=run([a,c],[rejected,later],JSON.parse(JSON.stringify([key])));
assert.equal(trip.points.length,3);
assert.ok(!trip.points.some(p=>p.t===rejected.t),'persisted rejected fix must not re-enter');
assert.ok(trip.points.some(p=>p.t===later.t),'unrelated valid backup fix must still recover');
console.log('Rejected fix replay prevention: PASS');
