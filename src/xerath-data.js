// Numeric snapshot: tools/xerath-original/character.json, extracted from the
// installed Xerath.wad.client. Ambiguous script behavior is documented separately.
export const XERATH={
  base:{moveSpeed:340,attackRange:525,attackSpeed:.658,attackSpeedRatio:.625,attackSpeedGrowth:.0136,windupFraction:.2,missileSpeed:2000,attackDamage:55,attackDamageGrowth:3,mana:400,manaGrowth:22,manaRegen:1.37,manaRegenGrowth:.16},
  Q:{name:'Pulso Arcano',damage:[70,110,150,190,230],apRatio:.9,mana:[80,90,100,110,120],cooldown:[9,8,7,6,5],minRange:750,range:1500,chargeTime:1.5,maxHold:3,castTime:.5,width:145,refund:.5},
  W:{name:'Olho da Destruição',damage:[50,85,120,155,190],apRatio:.65,mana:[80,90,100,110,120],cooldown:[14,13,12,11,10],range:1000,castTime:.25,delay:.75,radius:250,centerRadius:100,centerMultiplier:1.667,slow:.25,centerSlow:[.6,.65,.7,.75,.8],slowDuration:2.5},
  E:{name:'Orbe Eletrizante',damage:[70,100,130,160,190],apRatio:.45,mana:[60,65,70,75,80],cooldown:[13,12.5,12,11.5,11],range:1125,castTime:.25,speed:1400,radius:60,minStun:.75,maxStun:2.25},
  R:{name:'Rito Arcano',damage:[170,220,270],apRatio:.45,rampDamage:[20,25,30],rampRatio:.05,mana:[100,100,100],cooldown:[130,115,100],range:5000,radius:200,shots:[4,5,6],duration:10,delay:.6,shotCooldown:.6,startup:.5,refund:.5},
  passive:{cooldown:16,killRefund:3.5},
};
export function xerathRanks(level){const ranks={Q:0,W:0,E:0,R:0};for(const key of ['Q','W','E','Q','Q','R','Q','W','Q','W','R','W','W','E','E','R','E','E'].slice(0,Math.max(1,Math.min(18,level))))ranks[key]++;return ranks;}
export function xerathPassiveMana(level){let mana=30;for(let next=2;next<=Math.min(18,level);next++)mana+=next>=16?15:next>=11?12:next>=7?9:next>=4?6:3;return mana;}
export const xerathStun=distance=>Math.max(XERATH.E.minStun,Math.min(XERATH.E.maxStun,.5+distance*.0017));
