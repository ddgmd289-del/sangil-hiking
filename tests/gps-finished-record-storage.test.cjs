const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function completeFinishedRecord(){');
const end=html.indexOf('function addMark(',start);
assert.ok(start>=0&&end>start);
const source=html.slice(start,end);
let saved=[],fail=true,persisted=null,removed=0;
const noop=()=>{};
const c={trip:{id:123,state:'done',points:[{lat:35,lon:128}]},demo:false,focusNext:true,CURRENT:'current',loadRecords:()=>saved.slice(),saveRecords:r=>{if(fail)return false;saved=JSON.parse(JSON.stringify(r));return true},persist:()=>{persisted=JSON.parse(JSON.stringify(c.trip))},localStorage:{removeItem:()=>removed++},toast:noop,updateStats:noop,clearSavedRoute:noop,draw:noop,renderRecords:noop,speakHike:noop};
vm.createContext(c);
vm.runInContext(source,c);
c.completeFinishedRecord();
assert.equal(c.trip.id,123);
assert.equal(persisted.points.length,1);
assert.equal(removed,0);
assert.equal(saved.length,0);
fail=false;
c.completeFinishedRecord();
assert.equal(saved.length,1);
assert.equal(c.trip,null);
assert.equal(removed,1);
c.trip=persisted;
c.completeFinishedRecord();
assert.equal(saved.length,1);
assert.equal(c.trip,null);
assert.ok(html.includes("old.state==='done'"),'completed pending record is recoverable');
console.log('Finished record storage regression: PASS');

const storageStart=html.indexOf('function loadRecords(){');
const storageEnd=html.indexOf('// 인증은',storageStart);
assert.ok(storageStart>=0&&storageEnd>storageStart);
let raw=null,writes=0,blocked=false;
const sc={STORE:'records',toast:noop,localStorage:{getItem:()=>raw,setItem:(key,value)=>{if(blocked)throw Error('quota');writes++;raw=value}}};
vm.createContext(sc);
vm.runInContext(html.slice(storageStart,storageEnd),sc);
for(const invalid of ['{broken','{}','null','42']){
 raw=invalid;
 assert.ok(Array.isArray(sc.loadRecords()),'malformed storage must not crash callers');
 assert.equal(sc.loadRecords().length,0);
 assert.equal(sc.saveRecords([]),false);
 assert.equal(raw,invalid);
}
assert.equal(writes,0);
raw='[{"id":1}]';
assert.equal(sc.loadRecords()[0].id,1);
blocked=true;
assert.equal(sc.saveRecords([{id:2}]),false);
assert.equal(raw,'[{"id":1}]');
blocked=false;
assert.equal(sc.saveRecords([{id:1},{id:2}]),true);
assert.equal(JSON.parse(raw).length,2);
console.log('Existing record overwrite guard: PASS');

const lifecycleStart=html.indexOf('function pause(){');
assert.ok(lifecycleStart>=0&&end>lifecycleStart);
let nativeCalls=[],demoWrites=0,demoRemovals=0;
const lifecycle={trip:{id:456,state:'running',demo:true,segmentStarted:Date.now(),accMs:0,points:[]},demo:true,focusNext:true,CURRENT:'current',selectedMountain:null,window:{SangilNative:{pauseTracking:()=>nativeCalls.push('pause'),resumeTracking:()=>nativeCalls.push('resume'),stopTracking:()=>nativeCalls.push('stop')}},recoverNativeGps:()=>nativeCalls.push('recover'),confirm:()=>true,closeRest:noop,$:()=>({value:''}),loadRecords:()=>{throw Error('demo must not read saved records')},saveRecords:()=>{demoWrites++;return true},persist:noop,localStorage:{removeItem:()=>demoRemovals++},toast:noop,updateStats:noop,clearSavedRoute:noop,draw:noop,renderRecords:noop,speakHike:noop,Date};
vm.createContext(lifecycle);
const stepsStart=html.indexOf('function updateWorkoutSteps(){');
const stepsEnd=html.indexOf('function start(){',stepsStart);
assert.ok(stepsStart>=0&&stepsEnd>stepsStart);
const stepsSource=html.slice(stepsStart,stepsEnd);
vm.runInContext(stepsSource+html.slice(lifecycleStart,end),lifecycle);
lifecycle.pause();
assert.equal(lifecycle.trip.state,'paused');
lifecycle.resume();
assert.equal(lifecycle.trip.state,'running');
lifecycle.finish();
assert.equal(lifecycle.trip,null);
assert.equal(nativeCalls.length,0);
assert.equal(demoWrites,0);
assert.equal(demoRemovals,0);
console.log('Demo lifecycle isolates native GPS and saved records: PASS');

 // GPX production parser: DOM fixture tests for segment boundaries and invalid coordinates.
 const gpxStart=html.indexOf('function parseGpxPreview(text){');
 const gpxEnd=html.indexOf("$('#gpxImport').addEventListener",gpxStart);
 assert.ok(gpxStart>=0&&gpxEnd>gpxStart);
 const point=(lat,lon,localName='trkpt')=>({localName,getAttribute:k=>k==='lat'?lat:lon});
 let fixture={root:'gpx',errors:[],tracks:[],routes:[]};
 class FixtureParser{parseFromString(){return {documentElement:{localName:fixture.root},getElementsByTagName:()=>fixture.errors,getElementsByTagNameNS:(_ns,name)=>name==='trkseg'?fixture.tracks:fixture.routes}}}
 const gpxContext={DOMParser:FixtureParser};
 vm.runInNewContext(html.slice(gpxStart,gpxEnd),gpxContext);
 const parse=gpxContext.parseGpxPreview;
 fixture.tracks=[{children:[point('35','128'),point('35.01','128.01'),point('bad','128'),point('35.03','128.03')]},{children:[point('36','129'),point('36.01','129.01')]}];
 fixture.routes=[{children:[point('37','127','rtept'),point('37.01','127.01','rtept')]}];
 const preview=parse('<gpx/>');
 assert.equal(preview.imported,true);
 assert.equal(JSON.stringify(preview.segments.map(s=>s.length)),'[2,1,2,2]');
 assert.equal(preview.points.length,7);
 for(const p of [point(null,'128'),point('','128'),point('91','128'),point('35','181'),point('0','0')]){
  fixture.tracks=[{children:[p]}];fixture.routes=[];
  assert.throws(()=>parse('<gpx/>'),/표시할 경로/);
 }
 assert.throws(()=>parse('<!DOCTYPE gpx><gpx/>'),/지원하지 않는/);
 fixture.errors=[{}];assert.throws(()=>parse('<gpx/>'),/올바른 GPX/);
 fixture.errors=[];fixture.root='html';assert.throws(()=>parse('<html/>'),/올바른 GPX/);
 console.log('GPX preview segment and coordinate checks: PASS (DOM fixtures)');

 // Run actual workout step aggregation using native sensor response fixtures.
 let sensor={available:true,allowed:true,ready:true,lifetime:1000,boot:7,count:900};
 let stepWrites=0;const stepField={textContent:''};
 const stepContext={trip:{state:'running',demo:false},window:{SangilNative:{savedSteps:()=>JSON.stringify(sensor)}},$:()=>stepField,persist:()=>stepWrites++};
 vm.runInNewContext(stepsSource,stepContext);
 const update=()=>stepContext.updateWorkoutSteps();
 update();assert.equal(stepContext.trip.workoutSteps,0);
 sensor.lifetime=1030;update();assert.equal(stepContext.trip.workoutSteps,30);
 update();assert.equal(stepContext.trip.workoutSteps,30,'duplicate sample');
 sensor.count=2;sensor.lifetime=1040;update();assert.equal(stepContext.trip.workoutSteps,40,'midnight rollover');
 sensor.boot=8;sensor.lifetime=1045;update();assert.equal(stepContext.trip.workoutSteps,40,'reboot baseline');
 sensor.lifetime=1060;update();assert.equal(stepContext.trip.workoutSteps,55);
 sensor.lifetime=5;update();assert.equal(stepContext.trip.workoutSteps,55,'counter reset');
 sensor.lifetime=15;update();assert.equal(stepContext.trip.workoutSteps,65);
 stepContext.trip=JSON.parse(JSON.stringify(stepContext.trip));sensor.lifetime=20;update();assert.equal(stepContext.trip.workoutSteps,70,'restored workout');
 sensor.allowed=false;sensor.lifetime=30;update();assert.equal(stepContext.trip.workoutSteps,70);
 sensor.allowed=true;stepContext.trip.state='done';update();assert.equal(stepContext.trip.workoutSteps,70);
 stepContext.trip={state:'running',demo:true};update();assert.equal(stepContext.trip.workoutSteps,undefined);
 console.log('Workout steps sensor fixture regression: PASS');

 // Exercise production background checkpoint and adaptive recovery scheduler.
 const scheduleStart=html.indexOf('let lastScheduledRecovery=0;');
 const scheduleEnd=html.indexOf('setInterval(scheduleGpsRecovery,3000);',scheduleStart);
 const checkpointStart=html.indexOf('function checkpointWorkout(){');
 const checkpointEnd=html.indexOf("document.addEventListener('visibilitychange'",checkpointStart);
 assert.ok(scheduleStart>=0&&scheduleEnd>scheduleStart&&checkpointStart>=0&&checkpointEnd>checkpointStart);
 let clock=100000,recoveries=0,checkpoints=0,stepRefreshes=0;
 const scheduling={trip:{state:'running',demo:false},document:{hidden:false},Date:{now:()=>clock},lastFix:clock,recoverNativeGps:()=>recoveries++,updateWorkoutSteps:()=>stepRefreshes++,persist:()=>checkpoints++};
 vm.runInNewContext(html.slice(scheduleStart,scheduleEnd)+html.slice(checkpointStart,checkpointEnd),scheduling);
 scheduling.scheduleGpsRecovery();assert.equal(recoveries,1);
 for(let i=1;i<=4;i++){clock+=3000;scheduling.lastFix=clock;scheduling.scheduleGpsRecovery();}
 assert.equal(recoveries,1);
 clock+=3000;scheduling.lastFix=clock;scheduling.scheduleGpsRecovery();assert.equal(recoveries,2);
 clock+=12000;scheduling.scheduleGpsRecovery();assert.equal(recoveries,3);
 clock+=3000;scheduling.scheduleGpsRecovery();assert.equal(recoveries,4);
 scheduling.document.hidden=true;clock+=60000;scheduling.scheduleGpsRecovery();assert.equal(recoveries,4);
 scheduling.checkpointWorkout();assert.equal(checkpoints,1);assert.equal(stepRefreshes,1);
 scheduling.document.hidden=false;scheduling.restoreVisibleWorkout();assert.equal(recoveries,5);assert.equal(stepRefreshes,2);
 scheduling.trip.demo=true;scheduling.checkpointWorkout();scheduling.restoreVisibleWorkout();scheduling.scheduleGpsRecovery();assert.equal(recoveries,5);assert.equal(checkpoints,1);
 scheduling.trip={state:'done'};scheduling.scheduleGpsRecovery();scheduling.checkpointWorkout();scheduling.restoreVisibleWorkout();assert.equal(recoveries,5);assert.equal(checkpoints,1);
 console.log('Adaptive GPS recovery and background checkpoint regression: PASS');

 // Execute actual checkpoint persistence with an in-memory storage fixture.
 const persistStart=html.indexOf('function persist(){');
 const persistEnd=html.indexOf('function km(',persistStart);
 assert.ok(persistStart>=0&&persistEnd>persistStart);
 let checkpointRaw=null,checkpointWrites=0,checkpointFailures=0,writeBlocked=false,readBlocked=false;
 const pc={trip:{id:123,state:'running',distance:0,points:[]},CURRENT:'current',toast:()=>checkpointFailures++,localStorage:{
  getItem:()=>{if(readBlocked)throw Error('storage read unavailable');return checkpointRaw;},
  setItem:(_key,value)=>{if(writeBlocked)throw Error('quota');checkpointRaw=value;checkpointWrites++;}
 }};
 vm.runInNewContext(html.slice(persistStart,persistEnd),pc);
 pc.persist();assert.equal(checkpointWrites,1);
 pc.persist();assert.equal(checkpointWrites,1,'identical checkpoint does not write');
 pc.trip.distance=1;pc.trip.points.push({lat:35,lon:128});writeBlocked=true;
 pc.persist();assert.equal(checkpointFailures,1);assert.equal(JSON.parse(checkpointRaw).distance,0);
 writeBlocked=false;pc.persist();assert.equal(checkpointWrites,2);assert.equal(JSON.parse(checkpointRaw).distance,1);
 pc.trip.state='paused';pc.persist();assert.equal(checkpointWrites,3);
 readBlocked=true;pc.trip.state='running';pc.persist();assert.equal(checkpointFailures,2);
 readBlocked=false;pc.persist();assert.equal(checkpointWrites,4);
 checkpointRaw=null;pc.persist();assert.equal(checkpointWrites,5,'restore missing checkpoint even if object unchanged');
 pc.trip.demo=true;pc.persist();assert.equal(checkpointWrites,5);
 pc.trip=null;pc.persist();assert.equal(checkpointWrites,5);
 console.log('Checkpoint deduplication and write retry regression: PASS');

 // Execute actual local personal data deletion handler with simulated storage and native bridge.
 const deletionStart=html.indexOf("$('#deleteLocalPersonalData').addEventListener('click'");
 const deletionEnd=html.indexOf('\n',deletionStart);
 assert.ok(deletionStart>=0&&deletionEnd>deletionStart);
 const deletionSource=html.slice(deletionStart,deletionEnd);
 const personalKeys=['records','current','sangil-weight-kg','sangil-local-profile','sangil-unified-v2','sangil_selected_mountain_v1'];
 function deletionFixture(opts={}){
  const entries=new Map(personalKeys.map(k=>[k,'personal']));
  entries.set('unrelated','keep');
  const calls=[],alerts=[];let handler;
  const ctx={trip:opts.trip||null,STORE:'records',CURRENT:'current',
   $:()=>({addEventListener:(_event,fn)=>{handler=fn;}}),
   toast:()=>calls.push('blocked'),confirm:()=>opts.confirm!==false,prompt:()=>opts.word===undefined?'삭제':opts.word,
   alert:msg=>alerts.push(msg),location:{reload:()=>calls.push('reload')},
   window:opts.browser?{}:{SangilNative:{deleteGpsBackup:()=>{calls.push('gps');return opts.gps!==false;},deleteStepData:()=>{calls.push('steps');return opts.steps!==false;}}},
   localStorage:{removeItem:k=>{calls.push('remove:'+k);if(k!==opts.failedKey)entries.delete(k);},getItem:k=>entries.get(k)??null}
  };
  if(opts.noBridge)delete ctx.window.SangilNative.deleteGpsBackup;
  vm.runInNewContext(deletionSource,ctx);handler();
  return {entries,calls,alerts};
 }
 for(const opts of [{trip:{state:'running'}},{confirm:false},{word:'cancel'}]){
  const d=deletionFixture(opts);assert.equal(d.entries.size,7);assert.ok(!d.calls.includes('gps'));assert.equal(d.alerts.length,0);
 }
 for(const opts of [{gps:false},{noBridge:true},{steps:false}]){
  const d=deletionFixture(opts);assert.equal(d.entries.size,7);assert.ok(d.alerts[0].includes('실패'));
 }
 for(const opts of [{},{browser:true}]){
  const d=deletionFixture(opts);assert.equal(d.entries.size,1);assert.equal(d.entries.get('unrelated'),'keep');assert.ok(d.alerts[0].includes('삭제했습니다'));assert.ok(d.calls.includes('reload'));
 }
 const partial=deletionFixture({failedKey:'records'});assert.equal(partial.entries.get('records'),'personal');assert.ok(partial.alerts[0].includes('실패'));
 console.log('Confirmed personal data deletion and failure handling regression: PASS');

 // Exercise actual confirmed local deletion handler with isolated storage fixtures.
 const deletionStart=html.indexOf("$('#deleteLocalPersonalData').addEventListener('click',");
 const deletionEnd=html.indexOf('\n',deletionStart);
 assert.ok(deletionStart>=0&&deletionEnd>deletionStart);
 function deletionFixture(options={}){
  const keys=['records','current','sangil-weight-kg','sangil-local-profile','sangil-unified-v2','sangil_selected_mountain_v1'];
  const store=new Map([...keys,'unrelated'].map(k=>[k,'data']));
  const calls=[];let handler;
  const bridge={deleteGpsBackup:()=>{calls.push('gps');return options.gps!==false},deleteStepData:()=>{calls.push('steps');return options.steps!==false}};
  const ctx={trip:options.trip||null,STORE:'records',CURRENT:'current',window:options.web?{}:{SangilNative:bridge},$:()=>({addEventListener:(_,fn)=>{handler=fn}}),toast:()=>calls.push('blocked'),confirm:()=>options.confirm!==false,prompt:()=>options.typed===false?'취소':'삭제',localStorage:{removeItem:k=>store.delete(k),getItem:k=>store.get(k)??null},alert:m=>calls.push(m),location:{reload:()=>calls.push('reload')}};
  vm.runInNewContext(html.slice(deletionStart,deletionEnd),ctx);
  handler();return {store,calls};
 }
 for(const options of [{trip:{state:'running'}},{confirm:false},{typed:false}]){
  const result=deletionFixture(options);assert.equal(result.store.size,7);assert.ok(!result.calls.includes('gps'));
 }
 const gpsFailure=deletionFixture({gps:false});assert.equal(gpsFailure.store.size,7);assert.ok(!gpsFailure.calls.includes('steps'));assert.ok(gpsFailure.calls.some(x=>x.includes('실패')));
 const stepFailure=deletionFixture({steps:false});assert.equal(stepFailure.store.size,7);assert.ok(stepFailure.calls.some(x=>x.includes('실패')));
 for(const options of [{},{web:true}]){
  const result=deletionFixture(options);assert.equal(result.store.size,1);assert.equal(result.store.get('unrelated'),'data');assert.ok(result.calls.some(x=>x.includes('삭제했습니다')));
 }
 console.log('Confirmed personal data deletion and native failure guard regression: PASS');
