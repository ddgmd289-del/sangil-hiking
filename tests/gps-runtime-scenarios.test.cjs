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
assert.ok(Math.abs(km(a,b)-km(b,a))<1e-9,'Distance is symmetric');
const start=Date.UTC(2026,10,18,1);
const record=(type)=>({started:start,ended:start+180000,rests:[{type,started:start+30000,ended:start+90000}]});
assert.equal(paceSeconds(record('auto')),180,'Auto-pause cannot inflate speed by excluding uncertain time');
assert.equal(paceSeconds(record('manual')),120,'Manual rest excluded from moving time');
assert.equal(paceSeconds({started:start,ended:start+180000,rests:[]}),180);
assert.equal(paceSeconds({started:start,ended:start+180000,restStarted:start+120000,pauseReason:'auto'}),180);
assert.equal(paceSeconds({started:start,ended:start+180000,restStarted:start+120000,pauseReason:'manual'}),120);
console.log('Actual GPS distance and pace helper scenarios passed');
