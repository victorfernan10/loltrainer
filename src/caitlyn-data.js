// Installed Caitlyn.wad.client snapshot, decoded in tools/caitlyn-original.
// Values absent from client records are called out in tools/caitlyn-mechanics.md.
export const CAITLYN={
  base:{moveSpeed:325,attackRange:650,attackSpeed:.681,attackSpeedRatio:.625,attackSpeedGrowth:.04,windupFraction:.17708333135,missileSpeed:2500,attackDamage:62,attackDamageGrowth:3.8,mana:315,manaGrowth:40,manaRegen:1.48,manaRegenGrowth:.14,critMultiplier:2},
  passive:{stacks:5,criticalScaling:.8,markedRange:1300,trapMarkDuration:4,netMarkDuration:3},
  Q:{name:'Pacificadora de Piltover',damage:[50,95,140,185,230],totalADRatio:[1.25,1.45,1.65,1.85,2.05],secondaryMultiplier:.6,cooldown:[10,9,8,7,6],mana:[60,65,70,75,80],castTime:.625,range:1300,speed:2200,radius:60,piercedRadius:90},
  W:{name:'Armadilha Mecânica Yordle',damage:[35,80,125,170,215],bonusADRatio:.3,cooldown:.5,mana:[20,20,20,20,20],castTime:.25,range:800,charges:[3,3,4,4,5],recharge:[26,22,18,14,10],duration:[30,35,40,45,50],root:1.5,armTime:.9,radius:75,immunity:3},
  E:{name:'Rede Calibre 90',damage:[80,130,180,230,280],apRatio:.8,cooldown:[16,14,12,10,8],mana:[75,75,75,75,75],castTime:.15,range:800,speed:1600,radius:70,dashRange:400,dashSpeed:1000,slow:.5,slowDuration:1},
  R:{name:'Ás na Manga',damage:[300,475,650],bonusADRatio:1,criticalScaling:.3,cooldown:[90,90,90],mana:[100,100,100],castTime:1,range:3500,speed:3200,radius:40},
};
export function caitlynRanks(level){const ranks={Q:0,W:0,E:0,R:0};for(const key of ['Q','E','W','Q','Q','R','Q','W','Q','W','R','W','W','E','E','R','E','E'].slice(0,Math.max(1,Math.min(18,level))))ranks[key]++;return ranks;}
export function caitlynHeadshotBonus(level,totalAD,critChance=0,champion=true){return totalAD*((champion?(level>=13?.8:level>=7?.7:.6):1.1)+CAITLYN.passive.criticalScaling*critChance*(CAITLYN.base.critMultiplier-1));}
