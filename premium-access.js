/* Premium policy: no paid entitlement until trusted billing verification is implemented. */
(function(root){
  'use strict';
  const free=Object.freeze(['gps','distance','duration','speed','steps','calories','autoPause','voice','records','gpxImport']);
  const premium=Object.freeze(['gpxExport','offlineMaps','advancedStats','cloudBackup','adFree']);
  const policy=Object.freeze({
    freeFeatures:free,
    premiumFeatures:premium,
    billingEnabled:false,
    membership:()=> 'free',
    canAccess:feature=>free.includes(feature)
  });
  if(typeof module==='object'&&module.exports)module.exports=policy;
  else root.SangilPremium=policy;
})(typeof globalThis!=='undefined'?globalThis:this);
