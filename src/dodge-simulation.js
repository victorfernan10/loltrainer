export const dodgeSkills={
  xerathQ:{id:'xerathQ',champion:'Xerath',key:'Q',name:'Arcanopulse',kind:'beam',range:1450,width:145,speed:Infinity,warning:.5,color:'#b28aff',texture:'xerath_q.png'},
  nautilusQ:{id:'nautilusQ',champion:'Nautilus',key:'Q',name:'Dredge Line',kind:'missile',range:1100,width:180,speed:2000,warning:.25,color:'#68d2c8',texture:'nautilus.png'},
  threshQ:{id:'threshQ',champion:'Thresh',key:'Q',name:'Death Sentence',kind:'missile',range:1100,width:140,speed:1900,warning:.5,color:'#85d89d',texture:'thresh_q_head.png',trail:'thresh_q_trail.png'},
  // Lux uses a separate damage-stage delay; see tools/advanced-training.md.
  // Collision is no longer silently narrowed to make the exercise easier.
  luxR:{id:'luxR',champion:'Lux',key:'R',name:'Final Spark',kind:'beam',range:3340,width:190,speed:Infinity,warning:1,color:'#e5e7ff',texture:'lux_r_beam.png'},
  ezrealQ:{id:'ezrealQ',champion:'Ezreal',key:'Q',name:'Mystic Shot',kind:'missile',range:1200,width:120,speed:2000,warning:.25,color:'#8ccfff',texture:'ezreal_q_trail.png'},
  luxQ:{id:'luxQ',champion:'Lux',key:'Q',name:'Ligação da Luz',kind:'missile',range:1300,width:140,speed:1200,warning:.25,color:'#e9d5ff',texture:'lux_q_cap.png',trail:'lux_q_trail.png'},
  xerathE:{id:'xerathE',champion:'Xerath',key:'E',name:'Orbe Eletrizante',kind:'missile',range:1125,width:120,speed:1400,warning:.25,color:'#7cbfff',texture:'xerath_q_energy.png'},
  morganaQ:{id:'morganaQ',champion:'Morgana',key:'Q',name:'Ligação das Trevas',kind:'missile',range:1300,width:140,speed:1200,warning:.25,color:'#bd79e8',texture:'morgana_base_q_mis_core.png'},
  blitzcrankQ:{id:'blitzcrankQ',champion:'Blitzcrank',key:'Q',name:'Puxão Biônico',kind:'missile',range:1080,width:140,speed:1800,warning:.25,color:'#e9b766',texture:'blitzcrank_base_q_glow_01.png'},
  brandQ:{id:'brandQ',champion:'Brand',key:'Q',name:'Cauterizar',kind:'missile',range:1100,width:120,speed:1600,warning:.25,color:'#ff9d45',texture:'brand_q_core.png'},
  brandW:{id:'brandW',champion:'Brand',key:'W',name:'Pilar de Chamas',kind:'circle',range:900,width:480,speed:Infinity,warning:.875,color:'#ff8b45',texture:'brand_w_pillar.png'},
};

// Circle casts stop at their aimed location; lines continue to full range.
export function castEndpoint(skill,origin,aim){return skill.kind==='circle'?clampSkillRange(origin,aim,skill.range):fullCastEndpoint(origin,aim,skill.range);}
export function hazardDistance(point,skill,origin,endpoint){return skill.kind==='circle'?Math.hypot(point.x-endpoint.x,point.z-endpoint.z):pointSegmentDistanceXZ(point,origin,endpoint);}

export function pointSegmentDistanceXZ(point,start,end){
  const dx=end.x-start.x,dz=end.z-start.z,lengthSq=dx*dx+dz*dz;
  if(lengthSq===0)return Math.hypot(point.x-start.x,point.z-start.z);
  const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.z-start.z)*dz)/lengthSq));
  return Math.hypot(point.x-(start.x+t*dx),point.z-(start.z+t*dz));
}

export function skillshotHitsPoint(point,start,end,width,bodyRadius=65){
  return pointSegmentDistanceXZ(point,start,end)<=width/2+bodyRadius;
}

export function clampSkillRange(origin,target,range){
  const dx=target.x-origin.x,dz=target.z-origin.z,distance=Math.hypot(dx,dz),length=Math.min(distance,range);
  if(distance===0)return {x:origin.x,z:origin.z};
  return {x:origin.x+dx/distance*length,z:origin.z+dz/distance*length};
}

// A cast selects a direction, not a destination. Passing the aimed point must
// not despawn the missile or make a backwards step an automatic dodge.
export function fullCastEndpoint(origin,aim,range){
  const dx=aim.x-origin.x,dz=aim.z-origin.z,d=Math.hypot(dx,dz);
  return d<1e-8?{x:origin.x,z:origin.z+range}:{x:origin.x+dx/d*range,z:origin.z+dz/d*range};
}

// Sweep both bodies over the same frame. Testing only the player's final
// position misses fast crossings and can hit a location they already left.
export function movingPointDistance(playerBefore,playerAfter,missileBefore,missileAfter){
  return pointSegmentDistanceXZ({x:0,z:0},
    {x:missileBefore.x-playerBefore.x,z:missileBefore.z-playerBefore.z},
    {x:missileAfter.x-playerAfter.x,z:missileAfter.z-playerAfter.z});
}
