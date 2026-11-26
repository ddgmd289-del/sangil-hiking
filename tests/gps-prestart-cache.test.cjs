'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function onFix(');
const end=html.indexOf('// Recover GPS fixes',start);
assert(start>=0&&end>start,'onFix implementation found');
const now=Date.now();
const elements={};
const context={
 Date,Number,Math,console,
 trip:{started:now,state:'paused',pauseReason:'manual',points:[],demo:false},
 position:null,lastFix:0,
 $:selector=>elements[selector]??(elements[selector]={textContent:''}),
 updateStats:()=>{},draw:()=>{},km:()=>0
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
const fix=t=>({timestamp:t,coords:{latitude:35.25,longitude:128.8,altitude:null,accuracy:12}});
context.onFix(fix(now-60000));
assert.equal(context.position,null,'stale pre-start fix must not become current position');
assert.equal(context.lastFix,0,'stale pre-start fix must not mark GPS as received');
context.onFix(fix(now-2000));
assert.equal(context.position.t,now-2000,'small timestamp skew remains acceptable');
assert(context.lastFix>0,'current GPS fix is accepted');
console.log('GPS pre-start cached-fix regression: passed');
