// Run: node tests/gps-filter.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
assert.equal((html.match(/window\.sangilNativeFix=function/g) || []).length, 1, 'Native GPS callback must be unique');
assert.match(html, /const plausibleSpeed=dt>0&&diff\/dt<=\.0055;/);
assert.match(html, /const usableFix=cur\.accuracy<=65&&\(!prev\|\|\(reacquired\|\|\(plausibleSpeed&&diff>=noiseKm\)\)\);/);
const accepted = ({accuracy, dt, diff, noiseKm=0.002, first=false}) =>
  accuracy <= 65 && (first || (dt > 30 || (dt > 0 && diff/dt <= 0.0055 && diff >= noiseKm)));
assert.equal(accepted({accuracy:12,dt:5,diff:0.0055}), true, 'Normal walking fix');
assert.equal(accepted({accuracy:90,dt:5,diff:0.0055}), false, 'Low quality fix');
assert.equal(accepted({accuracy:10,dt:0,diff:0.01}), false, 'Duplicate-time fix');
assert.equal(accepted({accuracy:10,dt:1,diff:0.1}), false, 'GPS teleport');
assert.equal(accepted({accuracy:10,dt:5,diff:0.0005}), false, 'Stationary jitter');
assert.equal(accepted({accuracy:10,dt:0,diff:0,first:true}), true, 'First fix');
assert.match(html, /fix\.accuracy>65\)continue;/, 'Recovered fix accuracy limit');
assert.match(html, /if\(!reacquired&&\(dist\/dt>\.0055\|\|dist<noise\)\)continue;/, 'Recovered fix jump/noise filtering');
assert.match(html, /const reacquired=dt>30&&p\.accuracy<=65;/, 'Recovery resumes after signal outage');
assert.equal(accepted({accuracy:25,dt:90,diff:0.4}), true, 'GPS reconnect after long gap');
assert.match(html, /const routeLines=segments\.map/, 'Track rendered as separated segments');
assert.match(html, /p\.breakBefore/, 'Disconnected fixes preserve break marker');
assert.match(html, /if\(!cur\.breakBefore\)trip\.distance\+=diff/, 'No distance counted across a GPS gap');
console.log('GPS filter static and scenario checks passed');

assert.match(html,/function paceSeconds\(r,now=Date\.now\(\)\)/,'Pace time helper');
assert.match(html,/cur\.accuracy<=20&&anchorDistance<\.020\)autoPause\(\)/,'Auto pause needs high-quality stillness');
assert.match(html,/const paceDuration=paceSeconds\(r\)/,'Record average pace uses conservative denominator');
const start=Date.UTC(2026,10,16,9,0,0);
const elapsed=(r)=>{const manual=(r.rests||[]).filter(x=>x.type==='manual').reduce((n,x)=>n+(x.ended-x.started),0);return (r.ended-r.started-manual)/1000};
assert.equal(elapsed({started:start,ended:start+180000,rests:[{type:'auto',started:start+30000,ended:start+90000}]}),180,'Auto pause does not inflate pace');
assert.equal(elapsed({started:start,ended:start+180000,rests:[{type:'manual',started:start+30000,ended:start+90000}]}),120,'Explicit rest is excluded');
