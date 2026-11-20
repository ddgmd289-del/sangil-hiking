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
assert.ok(Math.abs(trip.distance-expected)<0.03,'recover approximately 3.1 km rather than a partial track');
assert.ok(trip.distance>partialDistance+1.7,'restore more than 1.7 km omitted from the live track');
const before=trip.distance;
vm.runInNewContext(source+'\nrecoverNativeGps();',sandbox,{timeout:5000});
assert.equal(trip.points.length,count,'replaying native backup does not duplicate fixes');
assert.equal(trip.distance,before,'replaying native backup does not inflate distance');
console.log('Native GPS 3.1 km synthetic recovery: PASS');
