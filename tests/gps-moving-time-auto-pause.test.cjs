const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function paceSeconds(');
const end=html.indexOf('function elapsed(){',start);
assert.ok(start>=0&&end>start,'production paceSeconds source exists');
const sandbox={Date,Number,Math,Array};
vm.runInNewContext(html.slice(start,end),sandbox,{timeout:3000});
const pace=sandbox.paceSeconds;
const t=1000000;
assert.equal(pace({started:t,ended:t+600000,rests:[]}),600,'uninterrupted moving time');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+120000,ended:t+300000}]}),420,'completed automatic pause excluded');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'manual',started:t+120000,ended:t+240000},{type:'auto',started:t+200000,ended:t+360000}]}),360,'overlapping pauses counted only once');
assert.equal(pace({started:t,rests:[],restStarted:t+300000,pauseReason:'auto'},t+600000),300,'ongoing automatic pause excluded');
assert.equal(pace({started:t,rests:[],restStarted:t+300000,pauseReason:'manual'},t+600000),300,'ongoing manual pause excluded');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t-100000,ended:t+700000}]}),0,'pause clamped to trip interval');
assert.equal(pace({started:null,ended:t+600000,rests:[]}),0,'missing start cannot become Unix epoch');
assert.equal(pace({started:'',ended:t+600000,rests:[]}),0,'empty start cannot become Unix epoch');
assert.equal(pace({started:0,ended:t+600000,rests:[]}),0,'zero start cannot become Unix epoch');
// Corrupted or duplicated rest history must not inflate stopped time or produce NaN.
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+120000,ended:t+300000},{type:'auto',started:t+120000,ended:t+300000}]}),420,'duplicate restored pauses counted once');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:'invalid',ended:t+300000},{type:'manual',started:t+400000,ended:t+350000}]}),600,'malformed and reversed pauses ignored');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+300000,ended:t+900000}]}),300,'pause extending past finish is clamped');
assert.equal(pace({started:t,ended:t+600000,rests:[],restStarted:t+300000,pauseReason:'auto'},t+600000),300,'ongoing pause cannot extend beyond finished trip');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:'',ended:t+300000}]}),600,'empty pause start must not subtract time');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'manual',started:null,ended:t+300000}]}),600,'null pause start must not subtract time');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+120000,ended:null}]}),600,'null pause end must not be interpreted as Unix epoch');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'manual',started:t+120000,ended:''}]}),600,'empty pause end must not be interpreted as Unix epoch');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+120000,ended:false}]}),600,'boolean pause end must not corrupt moving time');

assert.equal(pace({started:t,ended:true,rests:[]},t+600000),600,'boolean true end timestamp must use current time');
assert.equal(pace({started:t,ended:false,rests:[]},t+600000),600,'boolean false end timestamp must use current time');
// Restored pauses can start before trip creation; only the overlap with the trip counts.
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t-180000,ended:t+120000}]}),480,'pre-trip restored pause is clamped to trip start');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'manual',started:t-180000,ended:t+120000},{type:'auto',started:t+60000,ended:t+180000}]}),420,'pre-trip overlapping pauses are merged after clamping');
assert.equal(pace({started:t,ended:t+600000,rests:[{type:'auto',started:t+700000,ended:t+900000}]}),600,'future pause is ignored after trip finish');
assert.equal(pace({started:t,ended:t+600000,rests:[],restStarted:t-180000,pauseReason:'auto'},t+900000),0,'restored ongoing pause before trip starts cannot exceed trip duration');
console.log('Moving time excludes auto/manual pauses: PASS');

 // Home summary must use the same conservative denominator as saved details.
 const homeStart=html.indexOf('function refreshHomeOverview(){');
 const homeEnd=html.indexOf('refreshHomeOverview();window.addEventListener',homeStart);
 assert.ok(homeStart>=0&&homeEnd>homeStart);
 const today=Date.now()-600000;
 const records=[{started:today,ended:today+600000,distance:1,rests:[{type:'auto',started:today+120000,ended:today+300000}]},{started:today,ended:today+600000,distance:1,rests:[{type:'manual',started:today+120000,ended:today+240000}]}];
 // Fix the calendar date so midnight cannot make this regression intermittent.
 const fixed=new Date(2026,10,24,12).getTime();
 for(const r of records){const delta=fixed-r.started;r.started+=delta;r.ended+=delta;for(const rest of r.rests){rest.started+=delta;rest.ended+=delta}}
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fixed+600000]))}static now(){return fixed+600000}}
 const fields={};
 const home={Date:FixedDate,Math,Number,Array,loadRecords:()=>records,paceSeconds:sandbox.paceSeconds,speedDenominatorSeconds:sandbox.speedDenominatorSeconds,document:{getElementById:id=>fields[id]??=( {})}};
 vm.runInNewContext(html.slice(homeStart,homeEnd)+'\nrefreshHomeOverview();',home);
 assert.equal(fields.homeTodayKm.textContent,'2.00');
 assert.equal(fields.homeTodayMin.textContent,15);
 assert.equal(fields.homeTodaySpeed.textContent,'6.7');
 console.log('Home and saved statistics consistency: PASS');

 // Exercise calorie estimates execute the production function, not a copied formula.
 const calorieStart=html.indexOf('function calorieEstimate(r){');
 const calorieEnd=html.indexOf('function updateCalorieLabel()',calorieStart);
 assert.ok(calorieStart>=0&&calorieEnd>calorieStart);
 let weightSetting='65';
 const calorieContext={Math,Number,localStorage:{getItem:()=>weightSetting}};
 vm.runInNewContext(html.slice(calorieStart,calorieEnd),calorieContext);
 const estimate=calorieContext.calorieEstimate;
 assert.equal(estimate({activity:'걷기',distance:5}),228);
 assert.equal(estimate({activity:'산행',distance:5}),276);
 assert.equal(estimate({activity:'등산',distance:5}),276);
 assert.equal(estimate({activity:'달리기',distance:5}),325);
 for(const invalid of [null,'','invalid','Infinity','-1','251']){weightSetting=invalid;assert.equal(estimate({activity:'산행',distance:5}),276);}
 weightSetting='80';assert.equal(estimate({activity:'산행',distance:5}),340);
 for(const invalid of [NaN,Infinity,-1,0,null,'invalid'])assert.equal(estimate({activity:'산행',distance:invalid}),0);
 assert.equal(estimate(null),0);
 console.log('Production calorie estimate regression: PASS');

 // Execute the actual distance voice milestone functions.
 const voiceStart=html.indexOf('function distanceVoiceStep(distance){');
 const voiceEnd=html.indexOf('\n',html.indexOf('function announceDistance(){',voiceStart));
 assert.ok(voiceStart>=0&&voiceEnd>voiceStart);
 const heard=[];let voiceSaves=0;
 const voice={trip:{state:'running',distance:0.99,demo:false},announcedStep:0,persist:()=>voiceSaves++,speakHike:m=>heard.push(m),Math,Number};
 vm.runInNewContext(html.slice(voiceStart,voiceEnd),voice);
 voice.announceDistance();assert.equal(heard.length,0);
 voice.trip.distance=1;voice.announceDistance();assert.equal(heard.length,1);
 voice.trip.distance=1.2;voice.announceDistance();assert.equal(heard.length,1);
 voice.announcedStep=0;voice.announceDistance();assert.equal(heard.length,1,'persisted milestone suppresses repeats');
 voice.trip.distance=0.9;voice.announceDistance();assert.equal(heard.length,1);
 voice.trip.distance=2.01;voice.announceDistance();assert.equal(heard.length,2);
 assert.equal(voice.trip.announcedKm,2);
 voice.trip.state='paused';voice.trip.distance=3;voice.announceDistance();assert.equal(heard.length,2);
 voice.trip.state='running';voice.trip.demo=true;voice.announceDistance();assert.equal(heard.length,2);
 assert.equal(voiceSaves,2);
 for(const bad of [NaN,Infinity,-1,null,'bad'])assert.equal(voice.distanceVoiceStep(bad),0);
 console.log('Voice distance milestones regression: PASS');

 // Execute actual SVG result export, checking saved statistics and disconnected paths.
 const svgStart=html.indexOf('function exportHikeResultImage(record){');
 const svgEnd=html.indexOf('function parseGpxPreview(',svgStart);
 const gapStart=html.indexOf('function routeGap('),gapEnd=html.indexOf('function routeSegments(',gapStart);
 const kmStart=html.indexOf('function km('),kmEnd=html.indexOf('function fmtTime(',kmStart);
 const fmtStart=kmEnd,fmtEnd=html.indexOf('\n',fmtStart);
 assert.ok(svgStart>=0&&svgEnd>svgStart&&gapEnd>gapStart&&kmEnd>kmStart&&fmtEnd>fmtStart);
 let resultSvg='';
 const resultContext={Date,Math,Number,String,paceSeconds:sandbox.paceSeconds,speedDenominatorSeconds:sandbox.speedDenominatorSeconds,toast:()=>{},download:(_name,svg)=>{resultSvg=svg}};
 vm.runInNewContext(html.slice(kmStart,kmEnd)+html.slice(fmtStart,fmtEnd)+'\n'+html.slice(gapStart,gapEnd)+html.slice(svgStart,svgEnd),resultContext);
 resultContext.exportHikeResultImage({started:t,ended:t+600000,distance:1,rests:[{type:'auto',started:t+120000,ended:t+300000}],name:'A & B',points:[{lat:35,lon:128,t},{lat:35.001,lon:128.001,t:t+60000},{lat:35.002,lon:128.002,t:t+300000,breakBefore:true},{lat:35.003,lon:128.003,t:t+360000}]});
 assert.ok(resultSvg.includes('00:07'));
 assert.ok(resultSvg.includes('6.0 km/h'));
 assert.ok(resultSvg.includes('1.00 km'));
 assert.ok(resultSvg.includes('A &amp; B'));
 const routePath=resultSvg.match(/<path d="(M[^"]+)" fill="none" stroke="#ffffff" stroke-width="10"/)[1];
 assert.equal((routePath.match(/M/g)||[]).length,2);
 assert.equal((routePath.match(/L/g)||[]).length,2);
 assert.equal((resultSvg.match(/rotate\(/g)||[]).length,2);
 console.log('SVG result statistics and route gap regression: PASS');

 // Actual live HUD calculation must match the stored-record speed denominator.
 const liveStart=html.indexOf('function refreshHikeAverageSpeed(){');
 const liveEnd=html.indexOf('function syncHikeHud(){',liveStart);
 assert.ok(liveStart>=0&&liveEnd>liveStart);
 const speedField={textContent:''};
 const live={trip:null,$:()=>speedField,speedDenominatorSeconds:sandbox.speedDenominatorSeconds,Number};
 vm.runInNewContext(html.slice(liveStart,liveEnd),live);
 live.refreshHikeAverageSpeed();assert.equal(speedField.textContent,'— km/h');
 live.trip={started:t,ended:t+600000,distance:1,rests:[]};
 live.refreshHikeAverageSpeed();assert.equal(speedField.textContent,'6.0 km/h');
 live.trip.rests=[{type:'auto',started:t+120000,ended:t+300000}];
 live.refreshHikeAverageSpeed();assert.equal(speedField.textContent,'6.0 km/h');
 live.trip.rests=[{type:'manual',started:t+120000,ended:t+240000}];
 live.refreshHikeAverageSpeed();assert.equal(speedField.textContent,'7.5 km/h');
 for(const invalid of [NaN,Infinity,-1,'bad']){live.trip.distance=invalid;live.refreshHikeAverageSpeed();assert.equal(speedField.textContent,'— km/h');}
 console.log('Live average speed HUD regression: PASS');

 // Stress the actual SVG export with more points than JS spread argument limits.
 const largePoints=Array.from({length:150000},(_,i)=>({lat:35+i*0.0000001,lon:128,t:t+i*2000,accuracy:5}));
 largePoints[75000].breakBefore=true;
 resultSvg='';
 const largeRecord={started:t,ended:t+300000000,distance:1.67,rests:[],name:'Long track',workoutSteps:2300,points:largePoints};
 resultContext.exportHikeResultImage(largeRecord);
 assert.ok(resultSvg.startsWith('<svg '));
 assert.ok(resultSvg.includes('2,300 보'));
 assert.ok(resultSvg.includes('1.67 km'));
 const largeRoute=resultSvg.match(/<path d="(M[^"]+)" fill="none" stroke="#ffffff" stroke-width="10"/)[1];
 assert.equal((largeRoute.match(/M/g)||[]).length,2);
 assert.equal((largeRoute.match(/L/g)||[]).length,149998);
 assert.equal(largePoints.length,150000);
 assert.equal(largePoints[75000].breakBefore,true);
 console.log('Large 150000-point SVG export regression: PASS');
