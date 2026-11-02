import {Combat} from './combat.js';
import {SYNDRA as S,syndraRanks,syndraPassiveStacks,syndraPassiveMana} from './syndra-data.js';
import {pointSegmentDistanceXZ} from './dodge-simulation.js';

const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const clampPoint=(a,b,r)=>{const d=dist(a,b),t=d>r?r/d:1;return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};};
const direction=(a,b)=>{const d=dist(a,b)||1;return {x:(b.x-a.x)/d,z:(b.z-a.z)/d};};

// Sphere identity survives pickup, throw, push and R. Geometry and effects read
// this state; they never decide damage or collision. Script calibrations are in S.reconstruction.
export class SyndraCombat extends Combat {
  constructor(options={}){
    const targets=options.targets??[{id:'ryze-1',position:{x:-260,z:-240},maxHealth:3000},{id:'ryze-2',position:{x:390,z:-200},maxHealth:3000}];
    super({...options,targets,champion:'syndra'});
    this.ranks=syndraRanks(this.level);this.baseAP=Math.max(0,Number(options.abilityPower)||0);
    this.abilityHaste=Math.max(0,Number(options.abilityHaste)||0);
    this.splinters=Math.min(120,Math.max(0,options.syndraSplinters==null||Number(options.syndraSplinters)<0?5*(this.level-1):Number(options.syndraSplinters)||0));
    const growth=.7025*(this.level-1)+.0175*(this.level*this.level-1);
    this.attackDamage=S.base.attackDamage+S.base.attackDamageGrowth*growth;
    this.maxMana=S.base.mana+S.base.manaGrowth*growth;this.mana=this.maxMana;this.manaRegen=S.base.manaRegen+S.base.manaRegenGrowth*growth;
    this.unlimitedMana=options.unlimitedMana??true;this.cooldowns={Q:0,W:0,E:0,R:0};
    this.qCharges=this.maxQCharges;this.qRecharges=[];this.qGate=0;
    this.spheres=[];this.skillProjectiles=[];this.waves=[];this.rLaunches=[];this.heldId=null;this.casting=null;this.queued=null;
    this.passiveMarks=new Map();this.acceptSkills=true;this.feedback='Q cria · W pega/arremessa · E empurra · R no alvo';
    this.skillCasts=0;this.skillHits=0;this.stuns=0;this.spheresCreated=0;this.spheresThrown=0;this.rSpheres=0;this.executions=0;this.passiveProcs=0;
  }
  get abilityPower(){return this.baseAP*(this.splinters>=120?1.15:1);}
  get maxQCharges(){return this.splinters>=40?2:1;}
  get holding(){return this.spheres.find(s=>s.id===this.heldId)??null;}
  get busy(){return !!this.casting;}
  get pending(){return super.pending||this.busy||this.skillProjectiles.length>0||this.rLaunches.length>0||this.waves.length>0||this.spheres.some(s=>['forming','throw','pushed','landing'].includes(s.state));}
  cooldown(key){const haste=this.abilityHaste+(key==='Q'?this.ranks.R*S.R.qHastePerRank:0);return S[key].cooldown[this.ranks[key]-1]*100/(100+haste);}
  abilityState(key){
    const remaining=Math.max(0,(key==='Q'?(this.qCharges?this.qGate:this.qRecharges[0]??0):this.cooldowns[key])-this.time),held=key==='W'&&this.holding;
    return {rank:this.ranks[key],remaining,ready:!!this.ranks[key]&&(held?this.time>=held.recastAt:remaining<=1e-8),charges:key==='Q'?this.qCharges:undefined,
      returning:!!held,returnRemaining:held?Math.max(0,held.holdUntil-this.time):0,label:key==='R'?`R · ${this.rSphereCount()} esferas`:key==='W'&&held?'W · arremessar':key};
  }
  rSphereCount(position=this.playerPosition??{x:0,z:0}){return Math.min(7,3+this.spheres.filter(s=>s.state==='ground'&&dist(position,s.position)<=S.reconstruction.rSphereGatherRange).length);}
  reject(message){this.feedback=message;return false;}
  addSplinters(amount){
    const previous=this.maxQCharges;this.splinters=Math.min(120,this.splinters+amount);
    if(this.maxQCharges>previous)this.qCharges+=this.maxQCharges-previous;
  }
  passiveHit(target,spell){
    if(target.kind&&target.kind!=='champion')return;
    const key=`${target.id}:${target.generation}`,mark=this.passiveMarks.get(key);
    if(mark?.cooldown>this.time)return;
    if(mark&&mark.until>=this.time&&mark.castId!==spell.id){
      this.addSplinters(syndraPassiveStacks(this.level));this.passiveProcs++;
      this.mana=Math.min(this.maxMana,this.mana+syndraPassiveMana(this.level));
      this.passiveMarks.set(key,{cooldown:this.time+S.passive.targetCooldown});
    }else if(!mark||mark.until<this.time||mark.castId==null)this.passiveMarks.set(key,{castId:spell.id,until:this.time+S.passive.markWindow});
  }
  spellDamage(target,amount,spell){
    if(!target.alive)return;
    this.passiveHit(target,spell);const hits=this.hits;
    super.damageTarget(target,Math.round(amount),false,{spellId:spell.id,ability:spell.key});this.hits=hits;this.skillHits++;
    if(!target.alive&&target.kind==='siege')this.addSplinters(1);
  }
  damageFor(key){return S[key].damage[this.ranks[key]-1]+S[key].apRatio*this.abilityPower;}
  sphere(point,state='ground',extra={}){
    const sphere={id:++this.serial,position:copy(point),state,height:48,activeAt:this.time,expiresAt:this.time+S.Q.sphereDuration,...extra};
    this.spheres.push(sphere);return sphere;
  }
  castAbility(key,point,position,targetId=null){
    if(!this.acceptSkills||this.playerHealth<=0||!valid(point)||!valid(position)||!['Q','W','E','R'].includes(key))return false;
    this.playerPosition=copy(position);
    if(!this.ranks[key])return this.reject(`${key} ainda não aprendido`);
    if(this.busy){this.queued={key,point:copy(point),targetId,expires:this.time+.8};return true;}
    const held=key==='W'?this.holding:null,state=this.abilityState(key);
    if(!state.ready)return this.reject(`${key} em recarga`);
    let victim=null,picked=null;
    if(key==='R'){
      victim=this.target(targetId);
      if(!victim?.alive||(victim.kind&&victim.kind!=='champion'))return this.reject('R precisa de um campeão sob o cursor');
      if(dist(position,victim.position)>S.R.range)return this.reject('R: alvo fora de alcance (675 u)');
      point=victim.position;
    }
    if(key==='W'&&!held){
      picked=this.spheres.filter(s=>s.state==='ground'&&dist(s.position,position)<=S.W.pickupRange&&dist(s.position,point)<=S.W.extraSpherePickupRadius).sort((a,b)=>dist(a.position,point)-dist(b.position,point))[0];
      if(!picked)return this.reject('W: aponte uma esfera no chão (alcance 925 u)');
    }
    if(key==='E'&&dist(point,position)<1e-6)return this.reject('E: aponte uma direção');
    const cost=held?0:S[key].mana[this.ranks[key]-1];
    if(!this.unlimitedMana&&this.mana<cost)return this.reject('Mana insuficiente');
    this.cancel('spell');this.queued=null;if(!this.unlimitedMana)this.mana-=cost;
    this.recordCommand(key,point,targetId);if(!held)this.skillCasts++;
    const spell={id:++this.serial,key,ability:key,origin:copy(position),point:copy(point),targetId:victim?.id,generation:victim?.generation};
    this.feedback=S[key].name;
    if(key==='Q'){
      this.qCharges--;this.qGate=this.time+S.Q.chargeCooldown;
      this.qRecharges.push(Math.max(this.time,this.qRecharges.at(-1)??0)+this.cooldown('Q'));
      spell.point=clampPoint(position,point,S.Q.range);
      this.sphere(spell.point,'forming',{activeAt:this.time+S.Q.delay,expiresAt:this.time+S.Q.delay+S.Q.sphereDuration,spell});this.spheresCreated++;
      this.events.push({type:'spell',...spell,duration:S.Q.resourceCastTime});
    }else if(key==='W'){
      if(held){
        this.heldId=null;this.cooldowns.W=this.time+this.cooldown('W');this.spheresThrown++;
        spell.point=clampPoint(position,point,S.W.range);
        Object.assign(held,{state:'throw',origin:copy(held.position),end:copy(spell.point),startedAt:this.time,landAt:this.time+Math.max(S.reconstruction.wMinimumFlightTime,dist(held.position,spell.point)/S.reconstruction.wThrowSpeed),spell});
        this.events.push({type:'spell',...spell,phase:'throw',duration:.4});
      }else{
        this.heldId=picked.id;Object.assign(picked,{state:'held',holdUntil:this.time+S.reconstruction.wHoldDuration,recastAt:this.time+S.reconstruction.wRecastDelay});
        this.events.push({type:'spell',...spell,phase:'pickup',duration:.35},{type:'syndra-pickup',point:copy(picked.position)});
      }
    }else{
      this.cooldowns[key]=this.time+this.cooldown(key);this.order={type:'stop'};this.activeTargetId=null;
      this.casting={...spell,until:this.time+S[key].castTime};
      if(key==='E')this.casting.sphereIds=this.spheres.filter(s=>s.state==='ground'||s.state==='forming').map(s=>s.id);
      this.events.push({type:'spell',...spell,duration:S[key].castTime});
    }
    return true;
  }
  dropHeld(){const s=this.holding;if(!s)return;this.heldId=null;s.state='ground';s.height=48;s.expiresAt=this.time+S.Q.sphereDuration;this.cooldowns.W=this.time+this.cooldown('W');}
  interruptSkills(){this.casting=null;this.queued=null;}
  move(point){this.queued=null;super.move(point);}
  stop(){this.queued=null;super.stop();}
  endAttacks(){super.endAttacks();this.acceptSkills=false;this.queued=null;this.dropHeld();}
  takeDamage(amount){super.takeDamage(amount);if(this.playerHealth<=0){this.interruptSkills();this.dropHeld();this.acceptSkills=false;}}
  slow(target,amount,duration,after=this.time){target.slowAmount=amount;target.slowStartsAt=after;target.slowUntil=after+duration;}
  eHit(target,wave,stun=false){
    if(!wave.hits.has(target.id+':'+target.generation)){wave.hits.add(target.id+':'+target.generation);this.spellDamage(target,this.damageFor('E'),wave.spell);}
    if(!target.alive)return;
    if(stun){target.stunUntil=Math.max(target.stunUntil??0,this.time+S.E.stunDuration);this.stuns++;}
    if(this.splinters>=80)this.slow(target,S.E.upgradedSlow,S.E.upgradedSlowDuration,stun?target.stunUntil:this.time+S.reconstruction.eKnockbackDuration);
  }
  releaseCast(spell){
    if(spell.key==='E'){
      const dir=direction(spell.origin,spell.point),angle=(this.splinters>=80?S.E.upgradedConeDegrees:S.E.coneDegrees)*Math.PI/180/2;
      const cone=(point,radius=0)=>{const d=dist(spell.origin,point),v=direction(spell.origin,point);return d<=S.E.range+radius&&Math.acos(Math.max(-1,Math.min(1,v.x*dir.x+v.z*dir.z)))<=angle+Math.asin(Math.min(1,radius/(d||1)));};
      const wave={spell,hits:new Set(),pending:[],until:this.time+.35};
      for(const target of this.targets.filter(t=>t.alive&&cone(t.position,t.radius))){
        this.eHit(target,wave);if(!target.alive)continue;
        const push=direction(spell.origin,target.position);
        target.displacement={origin:copy(target.position),end:{x:spell.origin.x+push.x*(S.E.range+target.radius),z:spell.origin.z+push.z*(S.E.range+target.radius)},start:this.time,until:this.time+S.reconstruction.eKnockbackDuration};
        target.stunUntil=Math.max(target.stunUntil??0,target.displacement.until);
      }
      for(const sphere of this.spheres.filter(s=>spell.sphereIds.includes(s.id)&&['ground','forming'].includes(s.state)&&cone(s.position,100))){
        wave.pending.push({id:sphere.id,at:Math.max(sphere.activeAt,this.time+dist(spell.origin,sphere.position)/S.E.waveSpeeds[0])});
      }
      this.waves.push(wave);this.events.push({type:'syndra-wave',origin:spell.origin,point:spell.point,angleDegrees:angle*360/Math.PI,duration:.35});
    }else if(spell.key==='R'){
      const victim=this.target(spell.targetId);if(!victim?.alive||victim.generation!==spell.generation)return;
      const gathered=this.spheres.filter(s=>s.state==='ground'&&dist(spell.origin,s.position)<=S.reconstruction.rSphereGatherRange).sort((a,b)=>dist(a.position,spell.origin)-dist(b.position,spell.origin)).slice(0,4);
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3;gathered.unshift(this.sphere({x:spell.origin.x+Math.sin(a)*65,z:spell.origin.z+Math.cos(a)*65},'ultimate',{height:110}));}
      gathered.forEach((sphere,i)=>{sphere.state='ultimate';this.rLaunches.push({sphere,spell,at:this.time+i*S.reconstruction.rLaunchInterval,index:i});});this.rSpheres+=gathered.length;
    }
  }
  impact(sphere,key){
    let damage=this.damageFor(key);if(key==='W'&&this.splinters>=60)damage*=1+S.W.trueDamageBase+S.W.trueDamagePerAP*this.abilityPower;
    for(const target of this.targets.filter(t=>t.alive&&dist(t.position,sphere.position)<=S[key].radius+t.radius)){
      this.spellDamage(target,damage,sphere.spell);if(key==='W')this.slow(target,S.W.slow,S.W.slowDuration);
    }
    sphere.state='ground';sphere.height=48;sphere.expiresAt=this.time+S.Q.sphereDuration;
    this.events.push({type:'syndra-impact',point:copy(sphere.position),ability:key,radius:S[key].radius});
  }
  update(dt,position,moveTarget,speed,options={}){
    if(dt<=0)return false;let moving=false,remaining=dt;
    // Small fixed upper bound prevents fast sphere paths and Q→E ordering from
    // depending on rendering FPS. No lost elapsed time on a slow frame.
    while(remaining>1e-9){const step=Math.min(1/120,remaining);moving=this.step(step,position,moveTarget,speed,options)||moving;remaining-=step;}
    return moving;
  }
  step(dt,position,moveTarget,speed,{allowStart=true,allowActions=true}={}){
    const moving=super.update(dt,position,moveTarget,speed,{allowStart:allowStart&&allowActions&&!this.busy,allowActions:allowActions&&!this.busy});
    this.playerPosition=copy(position);this.mana=this.unlimitedMana?this.maxMana:Math.min(this.maxMana,this.mana+this.manaRegen*dt);
    while(this.qRecharges.length&&this.qRecharges[0]<=this.time+1e-8){this.qRecharges.shift();this.qCharges=Math.min(this.maxQCharges,this.qCharges+1);}
    for(const target of this.targets){const d=target.displacement;if(d){const t=Math.min(1,(this.time-d.start)/(d.until-d.start));target.position.x=d.origin.x+(d.end.x-d.origin.x)*t;target.position.z=d.origin.z+(d.end.z-d.origin.z)*t;if(t>=1)delete target.displacement;}}
    if(this.casting&&this.time+1e-8>=this.casting.until){const cast=this.casting;this.casting=null;this.releaseCast(cast);}
    for(const s of this.spheres){
      if(s.state==='forming'&&this.time+1e-8>=s.activeAt)this.impact(s,'Q');
      else if(s.state==='held'){
        s.position.x=position.x;s.position.z=position.z-55;s.height=160;
        if(this.time>=s.holdUntil)this.dropHeld();
      }else if(s.state==='throw'||s.state==='landing'){
        const t=Math.min(1,(this.time-s.startedAt)/(s.landAt-s.startedAt));s.position.x=s.origin.x+(s.end.x-s.origin.x)*t;s.position.z=s.origin.z+(s.end.z-s.origin.z)*t;s.height=48+(s.state==='throw'?110*(1-t)+95*Math.sin(Math.PI*t):90*Math.sin(Math.PI*t));
        if(t>=1){if(s.state==='throw')this.impact(s,'W');else{s.state='ground';s.height=48;s.expiresAt=this.time+6;}}
      }
    }
    for(const wave of this.waves){
      for(const task of wave.pending.filter(t=>t.at<=this.time+1e-8)){
        const s=this.spheres.find(s=>s.id===task.id);
        if(s?.state==='ground'){
          const dir=direction(wave.spell.origin,s.position);Object.assign(s,{state:'pushed',dir,travel:Math.max(0,S.reconstruction.eSphereEndpointRange-dist(wave.spell.origin,s.position)),wave,struck:new Set()});
        }
      }
      wave.pending=wave.pending.filter(t=>t.at>this.time+1e-8);
    }
    for(const s of this.spheres.filter(s=>s.state==='pushed')){
      const before=copy(s.position),step=Math.min(s.travel,S.E.sphereSpeed*dt);s.position.x+=s.dir.x*step;s.position.z+=s.dir.z*step;s.travel-=step;
      for(const t of this.targets.filter(t=>t.alive&&!s.struck.has(t.id+':'+t.generation)&&pointSegmentDistanceXZ(t.position,before,s.position)<=S.E.sphereMissileWidth+t.radius)){s.struck.add(t.id+':'+t.generation);this.eHit(t,s.wave,true);}
      if(s.travel<=1e-8){s.state='ground';s.expiresAt=this.time+6;}
    }
    this.waves=this.waves.filter(w=>w.pending.length||w.until>this.time);
    for(const launch of this.rLaunches.filter(l=>l.at<=this.time+1e-8))this.skillProjectiles.push({id:launch.sphere.id,kind:'R',position:copy(launch.sphere.position),height:110,speed:S.R.missileInitialSpeed,...launch});
    this.rLaunches=this.rLaunches.filter(l=>l.at>this.time+1e-8);
    for(const p of this.skillProjectiles){
      const victim=this.target(p.spell.targetId),validVictim=victim?.alive&&victim.generation===p.spell.generation;
      const end=validVictim?victim.position:p.spell.point,d=dist(p.position,end);p.speed=Math.min(S.R.missileMaxSpeed,p.speed+S.R.missileAcceleration*dt);
      const step=p.speed*dt,dir=direction(p.position,end);p.position.x+=dir.x*Math.min(d,step);p.position.z+=dir.z*Math.min(d,step);Object.assign(p.sphere.position,p.position);
      if(d<=step+1e-8){
        if(validVictim){this.spellDamage(victim,this.damageFor('R'),p.spell);if(victim.alive&&this.splinters>=100&&victim.health/victim.maxHealth<S.R.executeThreshold){this.executions++;this.spellDamage(victim,victim.health+(victim.shield??0),p.spell);}}
        const angle=p.index*2.39996,radius=90+(p.index%3)*22;
        Object.assign(p.sphere,{state:'landing',origin:copy(p.position),end:{x:end.x+Math.sin(angle)*radius,z:end.z+Math.cos(angle)*radius},startedAt:this.time,landAt:this.time+S.R.bounceDuration});p.done=true;
        this.events.push({type:'syndra-impact',point:copy(end),ability:'R',radius:70});
      }
    }
    this.skillProjectiles=this.skillProjectiles.filter(p=>!p.done);
    this.spheres=this.spheres.filter(s=>s.state!=='ground'||s.expiresAt>this.time);
    if(this.queued&&!this.busy&&allowActions&&allowStart){const q=this.queued;this.queued=null;if(q.expires>=this.time)this.castAbility(q.key,q.point,position,q.targetId);}
    return moving;
  }
  summary(time=this.time){return {...super.summary(time),champion:'syndra',skillCasts:this.skillCasts,skillHits:this.skillHits,stuns:this.stuns,spheresCreated:this.spheresCreated,spheresThrown:this.spheresThrown,rSpheres:this.rSpheres,executions:this.executions,splinters:this.splinters,passiveProcs:this.passiveProcs};}
}
