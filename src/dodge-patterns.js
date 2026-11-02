// Training policy, not recovered champion behavior. This module sees neither
// the player's cursor nor future movement orders. Spell physics stay unchanged.
export function dodgeWavePlan(random,{difficulty=2,drill='rhythm',available=0,advanced=false}={}){
  const level=Math.max(1,Math.min(3,Math.round(Number(difficulty)||2)));
  const limit=Math.max(0,Math.floor(Array.isArray(available)?available.length:Number(available)||0));
  let wanted=1;
  if(drill==='pressure')wanted=level;
  else if(drill==='rhythm')wanted=level===3?2:level===2&&random()<.55?2:1;
  else if(drill==='combat')wanted=level>=2&&random()<(level===3?.7:.4)?2:1;
  const count=Math.min(limit,wanted),corner=Math.floor(random()*4)%4;
  const cross=random()<.55;
  const adjacent=corner^(random()<.5?1:2);
  const corners=cross?[corner,corner^3,adjacent]:[corner,adjacent,corner^3];
  const cornerIndices=corners.slice(0,count);
  const firstLead=drill!=='precision'&&random()<(drill==='rhythm'?.75:.5);
  // Alternation covers both maintaining velocity and reversing at the right
  // time. A multi-caster volley always combines current and predicted aim.
  const aimModes=Array.from({length:count},(_,i)=>(i%2===0?firstLead:!firstLead)?'lead':'current');
  const castOffsets=[];
  const gap={1:[.5,.72],2:[.36,.52],3:[.24,.36]}[level];
  for(let i=0;i<count;i++)castOffsets.push(i===0?0:castOffsets[i-1]+gap[0]+random()*(gap[1]-gap[0])+(i===2?.08:0));
  // Multiply by pace once; these already include the difficulty progression.
  const cooldownFactor=({1:.95,2:.65,3:.38}[level]+random()*.18)*(advanced?.9:1);
  return {
    count,pattern:count<2?'single':cross?'crossfire':'sweep',cornerIndices,aimModes,castOffsets,cooldownFactor,
    // Cast delay + nominal travel time. Placement may use this floor for
    // missiles; it does not shorten native warnings or change collision radii.
    minimumResponseTime:{1:.92,2:.78,3:.68}[level],
  };
}

// Balanced enabled-skill bag. A sibling spell whose caster is already in the
// wave stays pending; it is never discarded or replaced by a duplicate caster.
export class DodgeDeck {
  constructor(random=Math.random){this.random=random;this.remaining=[];this.signature=null;this.cycle=0;}
  draw(ids,count,championFor=id=>id){
    const pool=[...new Set(ids)],signature=JSON.stringify([...pool].sort());
    if(signature!==this.signature){this.signature=signature;this.remaining=[];this.cycle=0;}
    const picked=[],casters=new Set(),uniqueCasters=new Set(pool.map(championFor));
    const limit=Math.min(Math.max(0,Math.floor(Number(count)||0)),uniqueCasters.size);
    while(picked.length<limit){
      if(!this.remaining.length){
        this.remaining=[...pool];this.cycle++;
        for(let i=this.remaining.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.remaining[i],this.remaining[j]]=[this.remaining[j],this.remaining[i]];}
      }
      const index=this.remaining.findIndex(id=>!casters.has(championFor(id)));
      if(index<0)break; // Keep blocked siblings for the next wave, before refill.
      const [id]=this.remaining.splice(index,1);picked.push(id);casters.add(championFor(id));
    }
    return picked;
  }
}
