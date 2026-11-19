// Run: node tests/gps-runtime-scenarios.test.cjs
// Execute the application's actual pure calculation helpers, not a mirrored test implementation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function extract(start,end){
  const a=html.indexOf(start);
  assert.ok(a>=0,'Missing app helper: '+start);
  const b=html.indexOf(end,a+start.length);
  assert.ok(b>a,'Missing helper boundary: '+end);
  return html.slice(a,b);
}
const source=extract('function km(a,b){','function elapsed(){');
const ctx=vm.createContext({Date,Math,Number,String});
vm.runInContext(source,ctx,{timeout:1000});
const km=vm.runInContext('km',ctx);
const paceSeconds=vm.runInContext('paceSeconds',ctx);
const a={lat:35,lon:128},b={lat:35.009,lon:128};
assert.ok(km(a,b)>0.99&&km(a,b)<1.02,'1km northbound track segment');
assert.equal(km(a,a),0,'Identical fixes add zero distance');
const synthetic=[{lat:35,lon:128},{lat:35.01,lon:128},{lat:35.02,lon:128},{lat:35.0279,lon:128}];
const cumulative=synthetic.slice(1).reduce((total,p,i)=>total+km(synthetic[i],p),0);
assert.ok(cumulative>3.08&&cumulative<3.13,'Continuous 3.1km track retains all consecutive segments');
const partial=km(synthetic[0],synthetic[1]);
assert.ok(cumulative>partial*2.7,'A single retained segment cannot stand in for the full track');

assert.ok(Math.abs(km(a,b)-km(b,a))<1e-9,'Distance is symmetric');
// Reversing a continuous track must preserve cumulative distance, not silently discard segments.
const reverse=[...synthetic].reverse();
const reversedDistance=reverse.slice(1).reduce((total,p,i)=>total+km(reverse[i],p),0);
assert.ok(Math.abs(cumulative-reversedDistance)<1e-8,'Reverse track retains the same 3.1km distance');
// Subdividing each GPS leg must not change the distance along a straight northbound route.
const subdivided=synthetic.flatMap((p,i)=>i===synthetic.length-1?[p]:[p,{lat:(p.lat+synthetic[i+1].lat)/2,lon:p.lon}]);
const subdividedDistance=subdivided.slice(1).reduce((total,p,i)=>total+km(subdivided[i],p),0);
assert.ok(Math.abs(cumulative-subdividedDistance)<1e-8,'Higher GPS sampling density retains the same distance');

// GPS may emit repeated fixes while the device is stationary; they must not add distance.
const withDuplicates=[synthetic[0],synthetic[0],synthetic[1],synthetic[1],synthetic[2],synthetic[3],synthetic[3]];
const duplicateDistance=withDuplicates.slice(1).reduce((total,p,i)=>total+km(withDuplicates[i],p),0);
assert.ok(Math.abs(cumulative-duplicateDistance)<1e-8,'Repeated identical GPS fixes do not inflate or erase the full track');
// A short east-west leg must be counted as well as north-south legs.
const eastStart={lat:35,lon:128},eastEnd={lat:35,lon:128.011};
assert.ok(km(eastStart,eastEnd)>0.99&&km(eastStart,eastEnd)<1.02,'East-west GPS movement contributes to distance');
// A GPS outage does not justify connecting a distant reacquisition fix as a walked segment.
// The geometry helper reports displacement; the runtime must decide whether to accept it.
const lastBeforeOutage={lat:35,lon:128};
const firstAfterOutage={lat:35.02,lon:128};
assert.ok(km(lastBeforeOutage,firstAfterOutage)>2.2,
  'A 2.2km reacquisition jump requires runtime GPS gap filtering, not blind accumulation');
// Short movement around the same location should remain numerically stable.
const tinyStep={lat:35.00001,lon:128};
assert.ok(km(lastBeforeOutage,tinyStep)>0&&km(lastBeforeOutage,tinyStep)<0.002,
  'Small GPS steps are measured in meters, not kilometers');
const start=Date.UTC(2026,10,18,1);
const record=(type)=>({started:start,ended:start+180000,rests:[{type,started:start+30000,ended:start+90000}]});
assert.equal(paceSeconds(record('auto')),180,'Auto-pause cannot inflate speed by excluding uncertain time');
assert.equal(paceSeconds(record('manual')),120,'Manual rest excluded from moving time');
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[]}),180);
assert.equal(paceSeconds({started:start,ended:0,rests:[]},start+180000),180,'Zero end timestamp means active trip, not completed trip');
assert.equal(paceSeconds({started:start,ended:'invalid',rests:[]},start+180000),180,'Corrupt end timestamp falls back to supplied current time');
assert.equal(paceSeconds({started:start,ended:start-1000,rests:[]},start+180000),0,'End before start never produces negative moving time');
assert.equal(paceSeconds({started:start,ended:start+180000,restStarted:start+120000,pauseReason:'auto'}),180);
assert.equal(paceSeconds({started:start,ended:start+180000,restStarted:start+120000,pauseReason:'manual'}),120);
// Rest intervals restored twice or overlapping must only be subtracted once.
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[
 {type:'manual',started:start+30000,ended:start+90000},
 {type:'manual',started:start+60000,ended:start+120000}
]}),90,'Overlapping manual rests are merged');
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[
 {type:'manual',started:start-60000,ended:start+30000},
 {type:'manual',started:start+150000,ended:start+240000}
]}),120,'Manual rests are clamped to trip boundaries');
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[
 {type:'manual',started:start+30000,ended:start+90000}
],restStarted:start+60000,pauseReason:'manual'}),30,'Open manual pause overlapping saved rest is not double counted');
// Corrupt or partially migrated rest records must not crash the activity summary.
assert.equal(paceSeconds({started:start,ended:start+180000,rests:null}),180);
assert.equal(paceSeconds({started:start,ended:start+180000,rests:{unexpected:true}}),180);
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[null,{type:'manual',started:start+30000,ended:start+90000}]}),120);

// Execute the actual native-backup pause exclusion predicate with migrated rest data.
const backupPauseLine=html.split('\n').find(line=>line.includes('Array.isArray(trip.rests)?trip.rests:[]')&&line.includes('fix.t>='));
assert.ok(backupPauseLine,'Native backup pause guard must exist');
const pausePredicate=backupPauseLine.trim().replace(/^if\(/,'').replace(/\)continue;$/,'');
const inBackupPause=(rests,restStarted,time)=>vm.runInNewContext(
  'Boolean('+pausePredicate+')',{trip:{rests,restStarted},fix:{t:time},Number,Array});
assert.equal(inBackupPause(null,null,start+60000),false,'Null migrated rests cannot crash GPS recovery');
assert.equal(inBackupPause({legacy:true},null,start+60000),false,'Object migrated rests cannot crash GPS recovery');
assert.equal(inBackupPause([null,{started:start+30000,ended:start+90000}],null,start+60000),true,'Valid pause excludes native backup fix even with null entry');
assert.equal(inBackupPause([{started:start+30000,ended:start+90000}],null,start+120000),false,'Fix after rest is recoverable');

// Run the actual gap-reconstruction rest guard against malformed restored records.
const gapLine=html.split('\n').find(line=>line.includes('const crossesRest='));
assert.ok(gapLine,'Native GPS reconstruction rest guard must exist');
const gapExpression=gapLine.trim().replace(/^const crossesRest=/,'').replace(/;$/,'');
const gapCrosses=(rests,restStarted,from,to)=>vm.runInNewContext(
 'Boolean('+gapExpression+')',{trip:{rests,restStarted},prev:{t:from},p:{t:to},Number,Array});
assert.equal(gapCrosses(null,null,start,start+60000),false,'Null rests cannot abort native route reconstruction');
assert.equal(gapCrosses({legacy:true},null,start,start+60000),false,'Object rests cannot abort native route reconstruction');
assert.equal(gapCrosses([null,{started:start+30000,ended:start+90000}],null,start,start+60000),true,'Valid rest still breaks the segment with a null entry');
assert.equal(gapCrosses([{started:'bad',ended:start+90000}],null,start,start+60000),false,'Invalid rest timestamps do not create false gaps');
assert.equal(gapCrosses([],start+30000,start,start+60000),true,'Open pause still breaks route segments');


// Restored records may carry legacy non-array rests. Closing a pause must not throw.
const closeRestSource=extract('function closeRest(r=trip){','function autoPause(){');
const pauseContext=vm.createContext({Date:{now:()=>start+180000},Array,Math});
vm.runInContext(closeRestSource,pauseContext,{timeout:1000});
for(const malformed of [null,{legacy:true},'bad']){
 const restored={restStarted:start+120000,pauseReason:'auto',rests:malformed,restMs:0};
 vm.runInContext('closeRest',pauseContext)(restored);
 assert.equal(restored.rests.length,1,'Closing restored pause creates a valid rests array');
 assert.equal(restored.rests[0].type,'auto');
 assert.equal(restored.restStarted,null);
}


// Guard against silently truncating the Android foreground-service backup.
// A long hike can produce far more than 250 fixes; dropping the oldest fixes
// permanently loses distance when the WebView was suspended.
const workflow=fs.readFileSync('.github/workflows/build-android-apk.yml','utf8');
assert.match(workflow,/getTrackBackup\(\): String \{[\s\S]*?f\.readText\(Charsets\.UTF_8\)/,
  'Native backup must expose the complete track rather than takeLast(250)');
assert.doesNotMatch(workflow,/getTrackBackup\(\): String \{[\s\S]{0,300}takeLast\(/,
  'Native backup must not truncate older GPS fixes');
assert.match(workflow,/source_commit=%s/,
  'APK assets must include a traceable source revision');

console.log('Actual GPS distance and pace helper scenarios passed');
