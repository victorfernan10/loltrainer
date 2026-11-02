// Installed Quinn character BIN. Rank arrays below use rank-1, unlike Riot's
// DataValues arrays. Script-only reconstruction values are identified separately.
// Provenance and limits: tools/quinn-mechanics.md.
export const QUINN={
  base:{moveSpeed:330,range:525,attackSpeed:.668,attackSpeedRatio:.668,attackSpeedGrowth:3.1,
    attackDamage:59,attackDamageGrowth:3.2,health:565,healthGrowth:107,
    mana:269,manaGrowth:35,manaRegen:1.4,manaRegenGrowth:.08,
    missileSpeed:2000,windupFraction:.3-.12456139922142029,castFrame:5.2,critMultiplier:2},
  passive:{markDuration:4,cooldown:7,critReduction:1-Math.exp(-1),range:1300,
    damageStart:15,damageEnd:120,bonusADRatio:.4},
  Q:{castTime:.25,range:1050,speed:1550,radius:60,explosionRadius:210,
    damage:[65,100,135,170,205],bonusADRatio:[.8,.85,.9,.95,1],apRatio:.5,
    mana:[50,55,60,65,70],cooldown:[11,10.5,10,9.5,9],nearsight:1.75,nearsightRange:350},
  W:{mana:[0,0,0,0,0],cooldown:[50,45,40,35,30],buffDuration:2,
    attackSpeed:[.28,.41,.54,.67,.8],moveSpeed:[.2,.25,.3,.35,.4],revealRange:2100,revealDuration:2},
  E:{range:600,usesBoundingBoxes:true,mana:[50,50,50,50,50],cooldown:[12,11,10,9,8],
    damage:[40,65,90,115,140],bonusADRatio:.2,slow:.5,slowDuration:1.5,
    // These trajectory values are a reconstruction, not fields from QuinnE.
    castTime:0,dashSpeed:2000,knockback:50,knockbackDuration:.25,reboundDistance:525,reboundSpeed:2000},
  R:{mana:[50,25,0],cooldown:3,channel:2,moveSpeed:[.7,1,1.3],radius:700,
    damage:[60,90,120],adRatio:.35,bonusADRatio:.35,slowDuration:3,markDuration:4.5},
};

// Deliberate leveling preset: E at level1 for the interruption exercise, then
// Q/W; maximize W, Q, E with R at6/11/16. It is a preset, not a forced game rule.
export function quinnRanks(level){
  const ranks={Q:0,W:0,E:0,R:0};
  for(const key of ['E','Q','W','W','W','R','W','Q','W','Q','R','Q','Q','E','E','R','E','E'].slice(0,Math.max(1,Math.min(18,Math.floor(level)))))ranks[key]++;
  return ranks;
}
export function quinnHarrierDamage(level,bonusAD=0){
  return QUINN.passive.damageStart+(QUINN.passive.damageEnd-QUINN.passive.damageStart)*(Math.max(1,Math.min(18,level))-1)/17+QUINN.passive.bonusADRatio*bonusAD;
}
// Multiplicative reduction per1% crit; critChance is a0..1 fraction.
export function quinnHarrierCooldown(critChance=0){return QUINN.passive.cooldown*Math.pow(.99,Math.max(0,Math.min(1,critChance))*100);}
