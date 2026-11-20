// Executable regression for native GPS recovery across a repaired signal gap.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function recoverNativeGps(){');
const end=html.indexOf('function refreshGpsDiagnostics(){',start);
assert.ok(start>=0&&end>start,'production GPS recovery function must exist');
const source=html.slice(start,end);
const base=Date.now()-180000;
const point=(n,s)=>({lat:37,lon:127+n*.0001,accuracy:5,t:base+s*1000});
const encode=p=>JSON.stringify({lat:p.lat,lng:p.lon,accuracy:p.accuracy,time:p.t});
function run(points,backup,rest=[],distance=0){
 const trip={started:base,state:'active',activity:'걷기',points,distance,rests:rest,restStarted:0};
 let saved=0;
 const ctx={trip,window:{SangilNative:{getTrackBackup:()=>backup}},km:(a,b)=>Math.abs(a.lon-b.lon)*88.8,persist(){saved++},updateStats(){},draw(){},console,Date,Number,Math,Set,JSON,Array};
 vm.runInNewContext(source+'\nrecoverNativeGps();',ctx);
 return {trip,saved};
}
// Live webview missed the middle point, but native recorder retained it.
// Without that point, the 0.01776 km jump is marked as a break.
const a=point(0,0),b=point(1,20),c=point(2,40);
let result=run([a,{...c,breakBefore:true}],[a,b,c].map(encode).join('\n'));
assert.equal(result.trip.points.length,3,'missing native fix must be merged');
assert.equal(result.trip.points[2].breakBefore,false,'reliable intermediate fix must repair the gap');
assert.ok(result.trip.distance>0.017 && result.trip.distance<0.019,'repaired route must count both ~8.88m segments without a tenfold unit error');
const original=result.trip.distance;
result=run(result.trip.points,[a,b,c].map(encode).join('\n'),[],original);
assert.equal(result.trip.points.length,3,'backup replay must be idempotent');
assert.equal(result.trip.distance,original,'backup replay must not double count distance');
// Explicitly paused points must not silently become traveled distance.
const pause={type:'manual',started:base+15000,ended:base+25000};
result=run([a],[a,b,c].map(encode).join('\n'),[pause]);
assert.equal(result.trip.points.some(p=>p.t===b.t),false,'manual rest fixes must remain excluded');
console.log('GPS repaired-gap and pause-boundary regression: PASS');
