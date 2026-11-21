// End-to-end synthetic 3.1 km native GPS recovery using the production recovery function.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const begin=html.indexOf('function recoverNativeGps(){');
const end=html.indexOf('function refreshGpsDiagnostics(){',begin);
assert.ok(begin>=0&&end>begin,'production recovery source found');
const source=html.slice(begin,end);
const start=Date.now()-3600000;
const count=311;
const fixes=Array.from({length:count},(_,i)=>({
 lat:35+i*0.00009,lon:128,accuracy:5,t:start+i*10000
}));
const backup=fixes.map(p=>JSON.stringify({lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t})).join('\n');
const km=(a,b)=>{const rad=Math.PI/180;const dLat=(b.lat-a.lat)*rad;const dLon=(b.lon-a.lon)*rad;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const expected=fixes.slice(1).reduce((sum,p,i)=>sum+km(fixes[i],p),0);
assert.ok(expected>3.08&&expected<3.13,'synthetic trail represents 3.1 km');
// Reproduce a partial live track (~1.33 km) followed by full native backup replay.
const partial=fixes.slice(0,134);
const partialDistance=partial.slice(1).reduce((sum,p,i)=>sum+km(partial[i],p),0);
assert.ok(partialDistance>1.30&&partialDistance<1.36,'partial track resembles reported 1.33 km');
const trip={started:start,state:'active',activity:'걷기',points:partial,distance:partialDistance,rests:[],restStarted:0};
const sandbox={trip,window:{SangilNative:{getTrackBackup:()=>backup}},km,persist(){},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox,{timeout:5000});
assert.equal(trip.points.length,count,'recover all 311 native fixes, not only the latest 250');
assert.deepEqual(Array.from(trip.points,p=>p.t),fixes.map(p=>p.t),'recovery must retain every original timestamp in order');
assert.deepEqual(Array.from(trip.points,p=>p.lat),fixes.map(p=>p.lat),'recovery must preserve the complete GPS route geometry');
assert.deepEqual(Array.from(trip.points,p=>p.lon),fixes.map(p=>p.lon),'recovery must preserve longitude as well as latitude');
assert.ok(trip.points.every(p=>!p.breakBefore),'continuous native fixes must not leave artificial route breaks');
assert.ok(trip.points.every((p,i)=>i===0||p.t>trip.points[i-1].t),'recovered timestamps must remain strictly increasing');
assert.ok(Math.abs(trip.distance-expected)<0.03,'recover approximately 3.1 km rather than a partial track');
assert.ok(trip.distance>partialDistance+1.7,'restore more than 1.7 km omitted from the live track');
const before=trip.distance;
vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox,{timeout:5000});
assert.equal(trip.points.length,count,'replaying native backup does not duplicate fixes');
assert.equal(trip.distance,before,'replaying native backup does not inflate distance');
assert.deepEqual(Array.from(trip.points,p=>p.t),fixes.map(p=>p.t),'second replay must not reorder the original GPS fixes');
// Regression: an incorrectly inferred automatic pause must not erase the
// native walking fixes or leave the route at the partial 1.33 km reading.
const autoTrip={
 started:start,state:'paused',pauseReason:'auto',activity:'걷기',
 points:partial.map(p=>({...p})),distance:partialDistance,
 rests:[{type:'auto',started:start+1400000,ended:start+1700000}],
 restStarted:0
};
const autoSandbox={trip:autoTrip,window:{SangilNative:{getTrackBackup:()=>backup}},
 km,persist(){},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
vm.runInNewContext(source+'\nrecoverNativeGps();',autoSandbox,{timeout:5000});
assert.equal(autoTrip.points.length,count,'auto-pause recovery retains all native walking fixes');
assert.ok(Math.abs(autoTrip.distance-expected)<0.03,'auto-pause recovery restores approximately 3.1 km');
assert.ok(autoTrip.points.every(p=>!p.breakBefore),'automatic pause does not create a false GPS segment break');
const autoDistance=autoTrip.distance;
vm.runInNewContext(source+'\nrecoverNativeGps();',autoSandbox,{timeout:5000});
assert.equal(autoTrip.distance,autoDistance,'auto-pause recovery replay cannot inflate distance');


// A real foreground service backup can be observed in multiple snapshots while
// the WebView remains alive. Replaying partial snapshots must grow monotonically
// to the full 3.1 km route without duplicating earlier fixes.
const chunkTrip={started:start,state:'active',activity:'걷기',points:partial.map(p=>({...p})),distance:partialDistance,rests:[],restStarted:0};
let availableBackup='';
const chunkSandbox={trip:chunkTrip,window:{SangilNative:{getTrackBackup:()=>availableBackup}},
 km,persist(){},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
let previousDistance=chunkTrip.distance;
for(const length of [160,220,280,count]){
 availableBackup=fixes.slice(0,length).map(p=>JSON.stringify({lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t})).join('\n');
 vm.runInNewContext(source+'\nrecoverNativeGps();',chunkSandbox,{timeout:5000});
 assert.equal(chunkTrip.points.length,length,'incremental backup restores all available fixes');
 assert.ok(chunkTrip.distance>=previousDistance,'incremental recovery never loses distance');
 previousDistance=chunkTrip.distance;
}
assert.ok(Math.abs(chunkTrip.distance-expected)<0.03,'incremental native recovery reaches 3.1 km');

console.log('Native GPS 3.1 km synthetic recovery: PASS');
