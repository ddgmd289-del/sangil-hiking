// Run: node tests/gps-filter.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /p\.breakBefore=!!\(crossesRest\|\|\(dist>\.12&&!safeBridge\)\|\|\(reacquired&&!safeBridge\)\)/, 'Replayed native fixes recompute stale segment breaks without bridging rests');
assert.match(html, /trip\.state==='done'\|\|!window\.SangilNative\?\.getTrackBackup/, 'Native GPS recovery remains available during pause while excluding pause-time fixes');
assert.match(html, /moved>=\.08&&cur\.accuracy<=20/, 'Auto-paused hike resumes on one high-confidence movement fix');
const workflow = fs.readFileSync('.github/workflows/build-android-apk.yml', 'utf8');
assert.match(workflow, /put\("alt", if \(loc\.hasAltitude\(\)\) loc\.altitude else 0\.0\)/, 'Native backup preserves altitude during screen-off tracking');
assert.equal((html.match(/window\.sangilNativeFix=function/g) || []).length, 1, 'Native GPS callback must be unique');
assert.match(html, /const plausibleSpeed=dt>0&&diff\/dt<=\(trip.activity==='달리기'\?\.0055:\.0033\);/);
assert.match(html, /cur\.t<Date\.now\(\)-86400000\|\|cur\.t>Date\.now\(\)\+60000/, 'Reject stale or future GPS timestamps');
assert.match(html, /t:p\.timestamp==null\?Date\.now\(\):Number\(p\.timestamp\)/, 'Invalid supplied timestamps must not be silently replaced');
assert.match(html, /fix\.t<=0/, 'Native backup rejects nonpositive timestamps');
assert.match(html, /const usableFix=cur\.accuracy<=65&&\(!prev\|\|\(dt>0&&\(reacquired\|\|\(plausibleSpeed&&diff>=noiseKm\)\)\)\);/);
const accepted = ({accuracy, dt, diff, noiseKm=0.002, first=false}) =>
  accuracy <= 65 && (first || (dt > 30 || (dt > 0 && diff/dt <= 0.0055 && diff >= noiseKm)));
assert.equal(accepted({accuracy:12,dt:5,diff:0.0055}), true, 'Normal walking fix');
assert.equal(accepted({accuracy:90,dt:5,diff:0.0055}), false, 'Low quality fix');
assert.equal(accepted({accuracy:10,dt:0,diff:0.01}), false, 'Duplicate-time fix');
assert.match(html, /if\(!position\|\|cur\.t>=position\.t\)\{position=cur;lastFix=Date\.now\(\);/, 'Delayed provider fixes must not rewind map or live GPS freshness');
assert.match(html, /if\(position&&cur\.t===position\.t&&cur\.lat===position\.lat&&cur\.lon===position\.lon\)return;/, 'Duplicate fixes are ignored');
assert.equal(accepted({accuracy:10,dt:1,diff:0.1}), false, 'GPS teleport');
assert.equal(accepted({accuracy:10,dt:5,diff:0.0005}), false, 'Stationary jitter');
assert.equal(accepted({accuracy:10,dt:0,diff:0,first:true}), true, 'First fix');
assert.match(html, /fix\.accuracy>65\)continue;/, 'Recovered fix accuracy limit');
assert.match(html, /Math\.abs\(cur\.lat\)>90\|\|Math\.abs\(cur\.lon\)>180/, 'Live GPS coordinate bounds');
assert.match(html, /Math\.abs\(fix\.lat\)>90\|\|Math\.abs\(fix\.lon\)>180/, 'Recovered GPS coordinate bounds');
assert.match(html, /cur\.accuracy<0/, 'Live GPS rejects negative accuracy');
assert.match(html, /cur\.lat===0&&cur\.lon===0/, 'Live GPS rejects null-island location');
assert.match(html, /trip\.points\?\.length&&cur\.t<=trip\.points\.at\(-1\)\.t\)return;/, 'Older live GPS fixes cannot change tracking or auto pause');
assert.match(html, /trip\.state==='paused'&&position&&cur\.t<position\.t\)return;/, 'Paused trip cannot resume from stale cross-provider fix');
assert.match(html, /position&&cur\.t<position\.t-30000\)return;/, 'GPS providers cannot replay fixes delayed over 30 seconds');
assert.match(html, /fix\.lat===0&&fix\.lon===0/, 'Recovered GPS rejects null-island location');
assert.match(html, /fix\.accuracy<0/, 'Recovered GPS rejects negative accuracy');
assert.match(html, /if\(!reacquired&&\(dist\/dt>\(trip.activity==='달리기'\?\.0055:\.0033\)\|\|dist<noise\)\)continue;/, 'Recovered fix jump/noise filtering');
assert.match(html, /const reacquired=dt>30&&p\.accuracy<=65;/, 'Recovery resumes after signal outage');
assert.match(html, /const safeBridge=reacquired&&dt<=180&&dist<=\.5&&dist\/dt<=/, 'Only bounded plausible outages may reconnect');
assert.match(html, /const crossesRest=\(trip\.rests\|\|\[\]\)\.some\(r=>prev\.t<r\.ended&&p\.t>r\.started\)/, 'Recovery checks whether merged GPS segments cross recorded rest');
assert.match(html, /p\.breakBefore=!!\(crossesRest\|\|\(dist>\.12&&!safeBridge\)\|\|\(reacquired&&!safeBridge\)\)/, 'Recovery recalculates unsafe and rest boundaries after merging fixes');
assert.equal(accepted({accuracy:25,dt:90,diff:0.4}), true, 'GPS reconnect after long gap');
assert.match(html, /const routeLines=segments\.map/, 'Track rendered as separated segments');
assert.match(html, /p\.breakBefore/, 'Disconnected fixes preserve break marker');
assert.match(html, /if\(prev&&!cur\.breakBefore\)trip\.distance\+=diff/, 'No distance counted across a GPS gap');
console.log('GPS filter static and scenario checks passed');

assert.match(html,/function paceSeconds\(r,now=Date\.now\(\)\)/,'Pace time helper');
assert.match(html,/cur\.accuracy<=20&&anchorDistance<\.020\)autoPause\(\)/,'Auto pause needs high-quality stillness');
assert.match(html,/const paceDuration=paceSeconds\(r\)/,'Record average pace uses conservative denominator');
const start=Date.UTC(2026,10,16,9,0,0);
const elapsed=(r)=>{const manual=(r.rests||[]).filter(x=>x.type==='manual').reduce((n,x)=>n+(x.ended-x.started),0);return (r.ended-r.started-manual)/1000};
assert.equal(elapsed({started:start,ended:start+180000,rests:[{type:'auto',started:start+30000,ended:start+90000}]}),180,'Auto pause does not inflate pace');
assert.equal(elapsed({started:start,ended:start+180000,rests:[{type:'manual',started:start+30000,ended:start+90000}]}),120,'Explicit rest is excluded');

assert.match(html,/trip\.state==='done'\|\|!window\.SangilNative\?\.getTrackBackup/,'Recovery remains available during pause and skips finished trips');
assert.match(html,/trip\.rests\|\|\[\]/,'Recovery excludes rest windows');
assert.match(html,/Math\.min\(\.012/,'Walking GPS noise floor');

// Saved-route lifecycle regressions: deleting records or ending a session must not leave stale map layers.
assert.match(html,/if\(saveRecords\(\[\]\)\)\{clearSavedRoute\(\)/,'Deleting all records clears map overlay');
assert.match(html,/if\(!trip\)\{if\(trackLine\)trackLine\.setLatLngs\(\[\]\)/,'Idle map clears old live track');
assert.match(html,/localStorage\.removeItem\(CURRENT\)\}catch\{\}clearSavedRoute\(\)/,'Finishing clears old map overlays');

assert.match(html,/if\(total\+0\.001<trip\.distance\)return;/,'Native backup must not reduce recorded distance');
assert.match(html,/if\(prev&&!cur\.breakBefore\)trip\.distance\+=diff;/,'First GPS fix must not add phantom distance');

assert.match(html,/filter\(x=>x&&x\.type==='manual'\)/,'Only manual pauses excluded from pace denominator');
assert.match(html,/Math\.max\(a,restEnd\)/,'Overlapping manual pauses merged before subtracting elapsed time');
assert.match(html,/const openRest=r\.restStarted&&r\.pauseReason==='manual'\?/,'Only ongoing manual rest excluded from pace');

assert.match(html,/window\.SangilNative\.startTracking\(\)/,'Native GPS starts');
assert.match(html,/navigator\.geolocation\.watchPosition\(onFix/,'Browser GPS fallback starts');

assert.match(html, /const bridgeGap=prev&&dt>0&&dt<=180&&diff<=\.5&&plausibleSpeed/, 'Live GPS bridges bounded accurate plausible gaps');

// Weak GPS drift must not indefinitely postpone a real stationary auto-pause.
assert.match(html,/cur\.accuracy<=20&&anchor\.accuracy<=20&&anchorDistance>=movementThresholdKm/,'Stationary timer only resets on high-confidence displacement');

// Same-count backup replay may repair lost segment boundaries without shortening tracks.
assert.match(html,/filtered\.length===\(trip\.points\|\|\[\]\)\.length&&total>trip\.distance\+0\.001/,'Same-count backup repairs missing distance');
assert.match(html,/if\(filtered\.length<\(trip\.points\|\|\[\]\)\.length\)return;/,'Native replay never reduces point count');

// Auto-resume must start a new segment instead of adding distance traveled while paused.
assert.match(html,/trip\.resumeBreakPending=true/,'Auto-resume marks next accepted GPS fix as new segment');
assert.match(html,/trip\.resumeBreakPending\|\|diff>\.12/,'First resumed fix cannot bridge the rest');
assert.match(html,/trip\.resumeBreakPending=false/,'Segment boundary flag clears after accepted fix');

// A stale segment break can be recalculated even without newly recovered native coordinates.
assert.match(html,/if\(!recovered\.length&&\!\(trip\.points\|\|\[\]\)\.some\(p=>p\.breakBefore\)\)return;/,'Recheck existing route breaks when native backup has no additional fixes');

// Auto-pause is provisional: never report an artificially fast pace after GPS drift.
assert.match(html,/filter\(x=>x\.type==='manual'\)/,'Pace excludes only confirmed manual rest');
assert.match(html,/r\.pauseReason==='manual'\?/,'Open auto-pause stays in pace denominator');

// Native GPS timestamps must not be replaced by wall-clock time when invalid.
assert.match(html,/window\.sangilNativeFix=function[\s\S]*?timestamp:Number\(t\)\}\)/,'Native callback passes timestamp through validation');
assert.doesNotMatch(html,/timestamp:Number\(t\)\|\|Date\.now\(\)/,'Invalid native timestamps cannot masquerade as current fixes');

// Rejected native replay must not mutate saved break markers in memory.
assert.match(html,/const all=\[\.\.\.\(trip\.points\|\|\[\]\)\.map\(p=>\(\{\.\.\.p\}\)\),\.\.\.recovered\]\.sort/,'Recovery operates on cloned route points before commit');
const saved=[{t:1,breakBefore:true},{t:2,breakBefore:false}];
const replay=saved.map(p=>({...p}));
replay[0].breakBefore=false;
assert.equal(saved[0].breakBefore,true,'Rejected replay cannot silently alter saved route boundaries');

// A GPS reception outage must not be mistaken for 3 minutes of confirmed stillness.
assert.match(html,/trip\.stationaryLastFixT&&cur\.t-trip\.stationaryLastFixT>30000/,'Stationary timer detects GPS reception gaps');
assert.match(html,/trip\.stationarySince=null;trip\.stationaryAnchor=null;/,'GPS gap clears unverified stillness');
assert.match(html,/trip\.stationaryLastFixT=cur\.t/,'Stationary timer remembers latest reception timestamp');
const stationaryAfterGap=(last,current,since)=>current-last>30000?null:since;
assert.equal(stationaryAfterGap(1000,32000,1000),null,'31-second outage resets stationary timer');
assert.equal(stationaryAfterGap(1000,30000,1000),1000,'29-second normal GPS cadence preserves timer');

// Isolated GPS out-and-back spikes must be removed from both route and distance.
assert.match(html,/const spike=!!\(beforePrev&&prev/, 'Live GPS spike detection exists');
assert.match(html,/trip\.distance=Math\.max\(0,trip\.distance-legIn\)/, 'False detour distance is rolled back');
assert.match(html,/trip\.points\.pop\(\)/, 'Spike waypoint is removed');
