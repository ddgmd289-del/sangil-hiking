// Run: node tests/gps-filter.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
assert.equal((html.match(/window\.sangilNativeFix=function/g) || []).length, 1, 'Native GPS callback must be unique');
assert.match(html, /const plausibleSpeed=dt>0&&diff\/dt<=\(trip.activity==='달리기'\?\.0055:\.0033\);/);
assert.match(html, /cur\.t<Date\.now\(\)-86400000\|\|cur\.t>Date\.now\(\)\+60000/, 'Reject stale or future GPS timestamps');
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

assert.match(html,/trip\.state!=='running'\|\|!window\.SangilNative/,'Recovery skips paused state');
assert.match(html,/trip\.rests\|\|\[\]/,'Recovery excludes rest windows');
assert.match(html,/Math\.min\(\.012/,'Walking GPS noise floor');

// Saved-route lifecycle regressions: deleting records or ending a session must not leave stale map layers.
assert.match(html,/if\(saveRecords\(\[\]\)\)\{clearSavedRoute\(\)/,'Deleting all records clears map overlay');
assert.match(html,/if\(!trip\)\{if\(trackLine\)trackLine\.setLatLngs\(\[\]\)/,'Idle map clears old live track');
assert.match(html,/localStorage\.removeItem\(CURRENT\)\}catch\{\}clearSavedRoute\(\)/,'Finishing clears old map overlays');

assert.match(html,/if\(total\+0\.001<trip\.distance\)return;/,'Native backup must not reduce recorded distance');
assert.match(html,/if\(prev&&!cur\.breakBefore\)trip\.distance\+=diff;/,'First GPS fix must not add phantom distance');

assert.match(html,/const rests=\(r\.rests\|\|\[\]\)\.reduce/,'Average speed excludes auto and manual rests');
assert.match(html,/const openRest=r\.restStarted\?/,'Average speed excludes ongoing rest');

assert.match(html,/window\.SangilNative\.startTracking\(\)/,'Native GPS starts');
assert.match(html,/navigator\.geolocation\.watchPosition\(onFix/,'Browser GPS fallback starts');
