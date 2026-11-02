// Current installed Yone.wad.client, checked 2026-10-27.
// Provenance and engine/script limits: tools/yone-mechanics-evidence.md.
export const YONE={
  moveSpeed:345,attackRange:175,baseAttackSpeed:.625,
  qRange:450,qWidth:80,q3Range:950,q3DashRange:450,q3Speed:1500,
  q3BodyRadius:100,qStackDuration:6,qKnockup:.75,qADRatio:1.05,
  eDuration:5,eDashRange:300,eDashSpeed:1200,eRecastLockout:.5,
  eStartBonus:.1,eEndBonus:.3,eRepeat:.3,
  eCooldown:[22,19,16,13,10],eRepeatByRank:[.25,.275,.3,.325,.35],
  // Script behavior not recovered: return speed and ramp duration are
  // explicit trainer calibrations, not values observed in the current BIN.
  eReturnSpeed:3000,eReturnCast:.225,eRampDuration:5,
  // W has conflicting old/general/client range declarations: 600 is the
  // castConeDistance, while castRange/client coneRange are 700.
  wRange:600,wAngle:80,wShieldDuration:1.5,
  rRange:1000,rWidth:225,rKnockup:.75,rBlinkBehind:200,
  // mSpell.spellCastTime=.125 is not the whole R windup. .75 is a
  // reconstruction calibration; script scheduling was not recovered.
  rCast:.75,rImpactDelay:.3,rRecovery:.45,rCooldown:[120,100,80],
};
// Inferred use of the named client data coefficients. bonusAS is a decimal
// bonus (0.8 = +80%), not total attacks per second or a percentage integer.
export const yoneQCooldown=bonusAS=>4*(1-Math.min(2/3,.6*Math.max(0,bonusAS)));
export const yoneQCast=bonusAS=>.35*(1-Math.min(.5,(5/12)*Math.max(0,bonusAS)));
export const yoneWCooldown=bonusAS=>14*(1-Math.min(4/7,.6*Math.max(0,bonusAS)));
export const yoneWCast=bonusAS=>.5*(1-Math.min(.5,(5/12)*Math.max(0,bonusAS)));

// PC patch 16.21.1 Data Dragon: item 3006 AS .30/MS45, rune8008
// 6% melee AS × 6 stacks. Fixed base-AS reference; no level/shard bonuses.
// Q cooldowns are user-calibrated training values, independent of these AS bonuses.
export const yoneRatings={
  1:{name:'Fácil · sem itens',bonusAS:0,moveSpeed:345,qCooldown:3.12},
  2:{name:'Médio · Grevas',bonusAS:.30,moveSpeed:390,qCooldown:2.4},
  3:{name:'Difícil · Grevas + Ritmo Fatal',bonusAS:.66,moveSpeed:390,qCooldown:1.54},
};
export const yoneRating=difficulty=>yoneRatings[difficulty]??yoneRatings[1];
