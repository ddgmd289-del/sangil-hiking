'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const match=html.match(/const safeBridge=(.*?);\s*const crossesRest=/s);
assert(match,'native GPS bridge expression missing');
const expr=match[1];
function bridge(prevAccuracy,accuracy,dt=60,dist=.05){
 const ctx={reacquired:true,dt,dist,p:{accuracy},prev:{accuracy:prevAccuracy},trip:{activity:'걷기'}};
 return vm.runInNewContext(expr,ctx);
}
assert.equal(bridge(0,0),true,'zero-meter accuracy is a valid accurate fix');
assert.equal(bridge(20,20),true,'normal accurate fixes bridge short outage');
assert.equal(bridge(70,20),false,'poor previous fix must not bridge');
assert.equal(bridge(20,70),false,'poor current fix must not bridge');
assert.equal(bridge(null,20),false,'missing previous accuracy must not bridge');
assert.equal(bridge(20,20,181),false,'long outage must not bridge');
console.log('Native GPS backup bridge accuracy regression: passed');
