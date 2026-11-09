import {Combat} from './combat.js';
import {CAITLYN as C,caitlynRanks,caitlynHeadshotBonus} from './caitlyn-data.js';
import {firstContact} from './quinn-combat.js';

const copy=p=>({x:p.x,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const direction=(a,b)=>{const d=distance(a,b);return d>1e-7?{x:(b.x-a.x)/d,z:(b.z-a.z)/d}:{x:0,z:-1};};
const endpoint=(a,d,r)=>({x:a.x+d.x*r,z:a.z+d.z*r});
const champion=t=>!t.kind||t.kind==='champion';

export class CaitlynCombat extends Combat {
  constructor(options={}){
    super({...options,champion:'caitlyn'});this.profile={...this.profile,...C.base};this.range=C.base.attackRange;
    this.ranks=caitlynRanks(this.level);const growth=.7025*(this.level-1)+.0175*(this.level*this.level-1);
    this.bonusAD=Math.max(0,Number(options.bonusAD)||0);this.critChance=Math.min(1,Math.max(0,(Number(options.critChance)||0)/100));
    this.abilityPower=Math.max(0,Number(options.abilityPower)||0);this.abilityHaste=Math.max(0,Number(options.abilityHaste)||0);this.random=options.random??Math.random;
    this.attackDamage=C.base.attackDamage+C.base.attackDamageGrowth*growth;this.attackDamage+=this.bonusAD;
    this.maxMana=C.base.mana+C.base.manaGrowth*growth;this.mana=this.maxMana;this.manaRegen=C.base.manaRegen+C.base.manaRegenGrowth*growth;this.unlimitedMana=options.unlimitedMana??true;
    this.cooldowns={Q:0,W:0,E:0,R:0};this.wCharges=this.ranks.W?C.W.charges[this.ranks.W-1]:0;this.wRechargeAt=Infinity;
    this.headshotStacks=0;this.headshots=0;this.trapHeadshots=0;this.netHeadshots=0;this.trapsTriggered=0;this.rIntercepted=0;
    this.traps=[];this.skillProjectiles=[];this.casting=null;this.channel=null;this.dash=null;this.acceptSkills=true;this.playerPosition={x:0,z:0};
    this.skillCasts=0;this.skillHits=0;this.abilityStats=Object.fromEntries(['Q','W','E','R'].map(k=>[k,{casts:0,hits:0,misses:0,targets:0}]));
    this.feedback='650 u de alcance · atire e recue · W/E preparam tiros na cabeça';
  }
  get busy(){return !!this.casting||!!this.dash;}
  get pending(){return super.pending||this.busy||this.skillProjectiles.length>0;}
  get maxWCharges(){return this.ranks.W?C.W.charges[this.ranks.W-1]:0;}
  cooldown(key){return (key==='W'?C.W.cooldown:C[key].cooldown[this.ranks[key]-1])*100/(100+this.abilityHaste);}
  get wRecharge(){return (C.W.recharge[this.ranks.W-1]??Infinity)*100/(100+this.abilityHaste);}
  marks(target){if(target.caitlynMarks?.generation!==target.generation)target.caitlynMarks={generation:target.generation,W:0,E:0};return target.caitlynMarks;}
  markedSource(target){const marks=this.marks(target);return marks.W>this.time?'W':marks.E>this.time?'E':null;}
  rangeFor(target){return this.markedSource(target)?C.passive.markedRange:this.range;}
  abilityState(key){const remaining=Math.max(0,this.cooldowns[key]-this.time),recharge=Math.max(0,this.wRechargeAt-this.time);return {rank:this.ranks[key],remaining:key==='W'&&!this.wCharges?recharge:remaining,ready:!!this.ranks[key]&&this.acceptSkills&&!this.busy&&this.playerHealth>0&&remaining<=1e-8&&(key!=='W'||this.wCharges>0),charges:key==='W'?this.wCharges:undefined,maxCharges:key==='W'?this.maxWCharges:undefined,rechargeRemaining:key==='W'&&this.wCharges<this.maxWCharges?recharge:0,label:C[key].name,channeling:key==='R'&&!!this.channel};}
  reject(message){this.feedback=message;return false;}
  cancel(reason='move'){
    // The empowered headshot windup is committed; new orders execute after it.
    if(this.windup?.headshot&&['move','stop','retarget'].includes(reason))return;
    super.cancel(reason);
  }
  beginAttack(target){
    super.beginAttack(target);const source=this.markedSource(target),headshot=!!source||this.headshotStacks>=C.passive.stacks;
    Object.assign(this.windup,{headshot,headshotSource:source??(headshot?'passive':null),critical:this.random()<this.critChance});
    Object.assign(this.events.at(-1),{headshot,headshotSource:this.windup.headshotSource,critical:this.windup.critical});
  }
  attackPayload(attack,target){
    const source=attack.headshotSource,headshot=attack.headshot,critical=attack.critical;
    let damage=this.attackDamage*(critical?C.base.critMultiplier:1);
    if(headshot){damage+=caitlynHeadshotBonus(this.level,this.attackDamage,this.critChance,champion(target));this.headshots++;
      if(source==='W'){damage+=C.W.damage[this.ranks.W-1]+C.W.bonusADRatio*this.bonusAD;this.marks(target).W=0;this.trapHeadshots++;}
      else if(source==='E'){this.marks(target).E=0;this.netHeadshots++;}
      else this.headshotStacks=0;
    }else this.headshotStacks=Math.min(C.passive.stacks,this.headshotStacks+1);
    return {damage:Math.round(damage),metadata:{attackId:attack.id,isBasicAttack:true,headshot,headshotSource:source,critical}};
  }
  mark(target,key){this.marks(target)[key]=this.time+(key==='W'?C.passive.trapMarkDuration:C.passive.netMarkDuration);target.revealedUntil=Math.max(target.revealedUntil??0,this.marks(target)[key]);}
  spellDamage(target,amount,spell){const hits=this.hits;super.damageTarget(target,Math.round(amount),false,{ability:spell.key,spellId:spell.id});this.hits=hits;this.skillHits++;}
  shape(spell){return {id:spell.id,key:spell.key,kind:spell.key==='W'?'circle':'missile',origin:copy(spell.origin),point:copy(spell.point),end:copy(spell.end??spell.point),startedAt:spell.startedAt,impactAt:spell.impactAt,radius:spell.radius??C[spell.key].radius,speed:C[spell.key].speed,...(spell.position?{position:copy(spell.position)}:{})};}
  visibleThreats(){return [...(this.casting?[this.casting]:[]),...this.skillProjectiles].map(s=>this.shape(s));}
  emitSpell(spell,phase,duration){this.events.push({type:'spell',...spell,ability:spell.key,phase,duration});}
  resolved(spell){const ids=[...spell.hitIds],stats=this.abilityStats[spell.key];stats[ids.length?'hits':'misses']++;stats.targets+=ids.length;this.events.push({type:'spell-resolved',...this.shape(spell),time:this.time,hit:!!ids.length,targetIds:ids});}
  castAbility(key,point,position,targetId=null){
    if(!this.acceptSkills||this.playerHealth<=0||!C[key]||!valid(point)||!valid(position))return false;
    if(!this.ranks[key])return this.reject(`${key} ainda não aprendido`);
    if(this.casting||this.windup?.headshot||(this.dash&&!['Q','W'].includes(key)))return this.reject('Conclua a conjuração atual');
    if(this.time+1e-8<this.cooldowns[key])return this.reject(`${key} em recarga`);
    if(key==='W'&&!this.wCharges)return this.reject('W: aguardando uma carga');
    const victim=key==='R'?this.target(targetId):null;
    if(key==='R'&&(!victim?.alive||!champion(victim)||distance(position,victim.position)>C.R.range+(victim.radius??65)))return this.reject('R: coloque o cursor sobre um campeão em alcance');
    if((key==='Q'||key==='E')&&distance(position,point)<.001)return false;
    const cost=C[key].mana[this.ranks[key]-1];if(!this.unlimitedMana&&this.mana<cost)return this.reject('Mana insuficiente');
    if(!this.unlimitedMana)this.mana-=cost;
    this.cancel('spell');this.playerPosition=copy(position);this.order={type:'stop'};this.activeTargetId=null;this.cooldowns[key]=this.time+this.cooldown(key);
    this.skillCasts++;this.abilityStats[key].casts++;this.recordCommand(key,point,targetId);
    const dir=direction(position,point),duration=C[key].castTime,spell={id:++this.serial,key,origin:copy(position),point:copy(point),direction:dir,startedAt:this.time,until:this.time+duration,impactAt:this.time+duration+C[key].range/(C[key].speed??Infinity),end:endpoint(position,dir,C[key].range),radius:C[key].radius,hitIds:new Set(),targetId:victim?.id,generation:victim?.generation};
    if(key==='W'){
      spell.point=mix(position,point,Math.min(1,C.W.range/(distance(position,point)||1)));spell.end=copy(spell.point);
      if(this.wCharges===this.maxWCharges)this.wRechargeAt=this.time+this.wRecharge;this.wCharges--;
    }
    this.casting=spell;if(key==='R'){this.channel=spell;spell.point=copy(victim.position);spell.impactAt=spell.until+distance(position,victim.position)/C.R.speed;}
    this.emitSpell(spell,key==='R'?'channel':'cast',duration);this.events.push({type:'spell-telegraph',...this.shape(spell)});this.feedback=C[key].name;return true;
  }
  interruptChannel(reason='interrupted'){
    if(!this.channel)return;const spell=this.channel;this.channel=null;this.casting=null;this.cooldowns.R=this.time+5;this.resolved(spell);this.emitSpell(spell,'end',.15);this.events.push({type:'cancel-spell',reason});
  }
  interruptSkills(){if(this.channel)this.interruptChannel('crowd-control');}
  takeDamage(amount){super.takeDamage(amount);if(this.playerHealth<=0){this.acceptSkills=false;this.casting=null;this.channel=null;this.dash=null;this.events.push({type:'cancel-spell'});}}
  endAttacks(){super.endAttacks();this.acceptSkills=false;}
  launch(spell,position){
    if(spell.key==='W'){
      const trap={...spell,position:copy(spell.point),armedAt:this.time+C.W.armTime,expiresAt:this.time+C.W.duration[this.ranks.W-1],triggeredAt:null};this.traps.push(trap);
      const live=this.traps.filter(t=>t.triggeredAt==null);if(live.length>this.maxWCharges){const oldest=live[0];oldest.expiresAt=this.time;this.resolved(oldest);oldest.resolved=true;}
      this.events.push({type:'trap-set',id:trap.id,position:copy(trap.position)});return;
    }
    if(spell.key==='R'){
      const victim=this.target(spell.targetId);this.channel=null;
      if(!victim?.alive||victim.generation!==spell.generation){this.resolved(spell);this.emitSpell(spell,'end',.15);return;}
      spell.point=copy(victim.position);spell.direction=direction(position,victim.position);this.emitSpell(spell,'fire',.2);
    }
    const missile={...spell,origin:copy(position),position:copy(position),travelled:0,launchedAt:this.time};missile.end=endpoint(missile.origin,missile.direction,C[spell.key].range);this.skillProjectiles.push(missile);
    if(spell.key==='E'){
      const origin=copy(position),end=endpoint(origin,spell.direction,-C.E.dashRange),duration=C.E.dashRange/C.E.dashSpeed;
      this.dash={...spell,origin,end,startedAt:this.time,until:this.time+duration,phase:'recoil'};this.emitSpell(spell,'dash',duration);
    }
  }
  targetAt(target,fraction){return target.previousPosition?mix(target.previousPosition,target.position,fraction):target.position;}
  update(dt,position,moveTarget,speed,options={}){
    if(dt<=0)return false;const initial=copy(position);let elapsed=0;
    while(elapsed<dt-1e-9){const step=Math.min(1/120,dt-elapsed);this.step(step,position,moveTarget,speed,options,elapsed/dt,(elapsed+step)/dt);elapsed+=step;}return distance(initial,position)>.001;
  }
  step(dt,position,moveTarget,speed,options,f0,f1){
    this.playerPosition=copy(position);const locked=this.busy;
    super.update(dt,position,moveTarget,speed,{...options,allowActions:options.allowActions!==false&&!locked,allowStart:options.allowStart!==false&&!locked});
    this.mana=this.unlimitedMana?this.maxMana:Math.min(this.maxMana,this.mana+this.manaRegen*dt);
    while(this.wCharges<this.maxWCharges&&this.time+1e-8>=this.wRechargeAt){this.wCharges++;this.wRechargeAt=this.wCharges<this.maxWCharges?this.wRechargeAt+this.wRecharge:Infinity;}
    if(this.channel){const victim=this.target(this.channel.targetId);if(!victim?.alive||victim.generation!==this.channel.generation)this.interruptChannel('target-lost');else this.channel.point=copy(victim.position);}
    if(this.dash){const d=this.dash,t=Math.min(1,(this.time-d.startedAt)/(d.until-d.startedAt));Object.assign(position,mix(d.origin,d.end,t));Object.assign(moveTarget,position);if(t>=1)this.dash=null;}
    if(this.casting&&this.time+1e-8>=this.casting.until){const spell=this.casting;this.casting=null;this.launch(spell,position);}
    for(const target of this.targets){target.caitlynGeneration??=target.generation;if(target.caitlynGeneration!==target.generation){target.caitlynGeneration=target.generation;target.caitlynTrapImmuneUntil=0;target.caitlynTrapVulnerableUntil=0;target.rootUntil=0;target.slowUntil=0;}}
    for(let i=this.traps.length-1;i>=0;i--){const trap=this.traps[i];
      if(this.time>=trap.expiresAt){if(trap.triggeredAt==null&&!trap.resolved){this.resolved(trap);trap.resolved=true;}this.traps.splice(i,1);continue;}
      if(trap.triggeredAt!=null||this.time<trap.armedAt||!this.acceptSkills)continue;
      const victim=this.targets.find(t=>t.alive&&champion(t)&&(t.caitlynTrapImmuneUntil??0)<=this.time&&firstContact(trap.position,trap.position,this.targetAt(t,f0),this.targetAt(t,f1),C.W.radius+t.radius)!=null);
      if(victim){trap.triggeredAt=this.time;trap.expiresAt=this.time+1.3;this.trapsTriggered++;trap.hitIds.add(victim.id);this.mark(victim,'W');victim.rootUntil=Math.max(victim.rootUntil??0,this.time+C.W.root);victim.caitlynTrapImmuneUntil=this.time+C.W.immunity;victim.caitlynTrapVulnerableUntil=this.time+C.passive.trapMarkDuration;this.resolved(trap);trap.resolved=true;this.events.push({type:'trap-trigger',id:trap.id,position:copy(trap.position),targetId:victim.id},{type:'spell-impact',key:'W',position:copy(victim.position),radius:C.W.radius});}
    }
    for(let i=this.skillProjectiles.length-1;i>=0;i--){const missile=this.skillProjectiles[i],data=C[missile.key],from=copy(missile.position);
      if(missile.key==='R'){const victim=this.target(missile.targetId);if(!victim?.alive||victim.generation!==missile.generation){this.resolved(missile);this.skillProjectiles.splice(i,1);continue;}missile.direction=direction(from,victim.position);}
      const range=missile.key==='R'?C.R.range*3:data.range,travel=Math.min(data.speed*Math.max(0,Math.min(dt,this.time-missile.launchedAt)),range-missile.travelled),end=endpoint(from,missile.direction,travel);
      const hits=this.targets.filter(t=>t.alive&&!missile.hitIds.has(t.id)&&(missile.key!=='R'||champion(t))).map(t=>({target:t,fraction:firstContact(from,end,this.targetAt(t,f0),this.targetAt(t,f1),missile.radius+t.radius)})).filter(h=>h.fraction!=null).sort((a,b)=>a.fraction-b.fraction);
      let consumed=false;
      for(const hit of hits){const victim=hit.target,point=mix(from,end,hit.fraction);let damage;
        if(missile.key==='Q'){damage=(C.Q.damage[this.ranks.Q-1]+C.Q.totalADRatio[this.ranks.Q-1]*this.attackDamage)*(missile.hitIds.size&&!(victim.caitlynTrapVulnerableUntil>this.time)?C.Q.secondaryMultiplier:1);missile.radius=C.Q.piercedRadius;}
        else if(missile.key==='E'){damage=C.E.damage[this.ranks.E-1]+C.E.apRatio*this.abilityPower;this.mark(victim,'E');victim.slowStartsAt=this.time;victim.slowUntil=this.time+C.E.slowDuration;victim.slowAmount=C.E.slow;}
        else{damage=(C.R.damage[this.ranks.R-1]+C.R.bonusADRatio*this.bonusAD)*(1+C.R.criticalScaling*this.critChance*(C.base.critMultiplier-1));if(victim.id!==missile.targetId)this.rIntercepted++;}
        missile.hitIds.add(victim.id);this.spellDamage(victim,damage,missile);this.events.push({type:'spell-impact',id:missile.id,key:missile.key,position:point,radius:missile.radius,targetId:victim.id});
        if(missile.key!=='Q'){missile.position=point;this.resolved(missile);this.skillProjectiles.splice(i,1);consumed=true;break;}
      }
      if(consumed)continue;missile.position=end;missile.travelled+=travel;
      if(missile.travelled>=range-1e-7){this.resolved(missile);this.skillProjectiles.splice(i,1);}
    }
  }
  summary(time=this.time){return {...super.summary(time),skillCasts:this.skillCasts,skillHits:this.skillHits,headshots:this.headshots,trapHeadshots:this.trapHeadshots,netHeadshots:this.netHeadshots,trapsTriggered:this.trapsTriggered,rIntercepted:this.rIntercepted,headshotStacks:this.headshotStacks,mana:Math.round(this.mana),maxMana:Math.round(this.maxMana),abilityStats:structuredClone(this.abilityStats)};}
}
