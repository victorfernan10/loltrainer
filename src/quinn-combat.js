import {Combat,PLAYER_RADIUS} from './combat.js';
import {QUINN as S,quinnRanks,quinnHarrierDamage,quinnHarrierCooldown} from './quinn-data.js';
import {effectiveSpeed} from './simulation.js';

const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const toward=(a,b,length)=>{const d=dist(a,b)||1;return {x:a.x+(b.x-a.x)*length/d,z:a.z+(b.z-a.z)*length/d};};
// Earliest contact, sweeping BOTH moving bodies over the same time interval.
export function firstContact(a,b,c,d,radius){
  const ox=a.x-c.x,oz=a.z-c.z,dx=b.x-a.x-d.x+c.x,dz=b.z-a.z-d.z+c.z;
  const cc=ox*ox+oz*oz-radius*radius;if(cc<=0)return 0;
  const aa=dx*dx+dz*dz;if(aa<1e-12)return null;
  const bb=2*(ox*dx+oz*dz),disc=bb*bb-4*aa*cc;if(disc<0)return null;
  const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:null;
}
export function movingVictim(target,time){
  const dash=target.vaultDash;
  if(dash&&!(dash.interruptedAt<=time))return mix(dash.origin,dash.end,Math.max(0,Math.min(1,(time-dash.startedAt)/(dash.until-dash.startedAt))));
  return copy(target.position);
}

export class QuinnCombat extends Combat {
  constructor(options={}){
    super({...options,champion:'quinn',targets:options.targets??[{id:'ryze-1',position:{x:-260,z:-240},maxHealth:3000},{id:'ryze-2',position:{x:390,z:-200},maxHealth:3000}]});
    this.ranks=quinnRanks(this.level);this.baseAttackSpeed=this.attackSpeed;this.random=options.random??Math.random;
    const growth=.7025*(this.level-1)+.0175*(this.level*this.level-1);
    this.bonusAD=Math.max(0,Number(options.bonusAD)||0);this.critChance=Math.max(0,Math.min(1,(Number(options.critChance)||0)/100));this.abilityPower=Math.max(0,Number(options.abilityPower)||0);this.abilityHaste=Math.max(0,Number(options.abilityHaste)||0);
    this.attackDamage=59+3.2*growth+this.bonusAD;this.maxMana=269+35*growth;this.mana=this.maxMana;this.manaRegen=1.4+.08*growth;this.unlimitedMana=options.unlimitedMana??true;
    this.cooldowns={Q:0,W:0,E:0,R:0};this.casting=null;this.dash=null;this.skillProjectiles=[];this.queued=null;this.acceptSkills=true;
    this.valor=false;this.valorSlowedUntil=0;this.heightenedUntil=0;this.visionUntil=0;this.passiveReadyAt=0;this.playerPosition={x:0,z:0};
    this.skillCasts=0;this.skillHits=0;this.harrierProcs=0;this.vaults=0;this.skystrikes=0;this.feedback='Q: Valor · W: visão · E: alvo sob o cursor · R: voar / Ataque do Céu';
  }
  get busy(){return !!this.casting||!!this.dash;}
  get pending(){return super.pending||this.busy||this.skillProjectiles.length>0;}
  get speedMultiplier(){
    const w=this.time<this.heightenedUntil&&this.ranks.W?S.W.moveSpeed[this.ranks.W-1]:0;
    const r=this.valor&&this.time>=this.valorSlowedUntil?S.R.moveSpeed[this.ranks.R-1]??0:0;
    return effectiveSpeed(330*(1+w+r))/330;
  }
  abilityState(key){const remaining=key==='R'&&this.valor?0:Math.max(0,this.cooldowns[key]-this.time);return {rank:this.ranks[key],remaining,ready:!!this.ranks[key]&&(key==='R'&&this.valor||remaining<=1e-8),label:key==='R'?(this.valor?'Ataque do Céu':'Retaguarda do Inimigo'):key};}
  reject(message){this.feedback=message;return false;}
  mark(target,duration=S.passive.markDuration){if(target.alive)target.quinnMarkUntil=this.time+duration;}
  spellDamage(target,amount,spell){const hits=this.hits;super.damageTarget(target,Math.round(amount),false,{spellId:spell.id,ability:spell.key});this.hits=hits;this.skillHits++;}
  damageTarget(target,amount,priorityHit=false,metadata={}){
    if(this.random()<this.critChance)amount*=S.base.critMultiplier;
    if(target.quinnMarkUntil>this.time){
      target.quinnMarkUntil=0;this.harrierProcs++;
      amount+=quinnHarrierDamage(this.level,this.bonusAD);
      this.heightenedUntil=this.time+S.W.buffDuration;
      this.events.push({type:'harrier',position:copy(target.position),targetId:target.id});
    }
    super.damageTarget(target,Math.round(amount),priorityHit,metadata);
  }
  beginAttack(target){if(this.valor)this.skystrike(this.playerPosition);super.beginAttack(target);const event=this.events.at(-1);if(event?.type==='start')event.harrier=target.quinnMarkUntil>this.time;}
  skystrike(position){
    if(!this.valor)return false;this.valor=false;this.skystrikes++;this.cooldowns.R=this.time+S.R.cooldown;
    const spell={id:++this.serial,key:'R'};
    for(const target of this.targets)if(target.alive&&dist(position,target.position)<=S.R.radius+target.radius){this.spellDamage(target,S.R.damage[this.ranks.R-1]+S.R.bonusADRatio*this.bonusAD,spell);this.mark(target,S.R.markDuration);}
    this.events.push({type:'spell',...spell,ability:'R',phase:'skystrike',point:copy(position),origin:copy(position),duration:.3},{type:'spell-impact',key:'R',position:copy(position),radius:S.R.radius});return true;
  }
  castAbility(key,point,position,targetId=null){
    if(!this.acceptSkills||this.playerHealth<=0||!valid(point)||!valid(position)||!['Q','W','E','R'].includes(key))return false;
    this.playerPosition=copy(position);if(!this.ranks[key])return this.reject(`${key} ainda não aprendido`);
    if(key==='R'&&this.valor){this.recordCommand('R');this.skillCasts++;this.skystrike(position);return true;}
    const cancelChannel=this.casting?.key==='R'&&key!=='R';
    if(this.busy&&!cancelChannel){this.queued={key,point:copy(point),targetId,expires:this.time+.6};return true;}
    if(this.time+1e-8<this.cooldowns[key])return this.reject(`${key} em recarga`);
    const rank=this.ranks[key],mana=S[key].mana[rank-1]??0;
    if(!this.unlimitedMana&&this.mana<mana)return this.reject('Mana insuficiente');
    const victim=key==='E'?this.target(targetId):null;
    if(key==='E'&&(!victim?.alive||dist(position,victim.position)>S.E.range+PLAYER_RADIUS+victim.radius))return this.reject('E: coloque o cursor sobre um alvo em alcance');
    if(key==='Q'&&dist(position,point)<1e-7)return false;
    if(cancelChannel)this.interruptSkills();
    if(this.valor&&key!=='W')this.skystrike(position);
    if(!this.unlimitedMana)this.mana-=mana;
    this.cooldowns[key]=this.time+(key==='R'?S.R.cooldown:S[key].cooldown[rank-1]*100/(100+this.abilityHaste));
    this.skillCasts++;this.recordCommand(key,point,targetId);
    const spell={id:++this.serial,key,ability:key,rank,origin:copy(position),point:copy(point),startedAt:this.time,targetId:victim?.id,generation:victim?.generation};
    if(key==='W'){
      this.visionUntil=this.time+S.W.revealDuration;this.events.push({type:'spell',...spell,duration:0});
      for(const target of this.targets)if(target.alive&&dist(position,target.position)<=S.W.revealRange)target.revealedUntil=this.visionUntil;
      this.feedback='Sentidos Apurados · visão concedida';return true;
    }
    this.cancel('spell');this.order={type:'stop'};this.activeTargetId=null;this.queued=null;
    if(key==='E'){
      this.readyAt=this.time;this.dash={...spell,phase:'dash',fallback:dist(position,victim.position)>1e-7?{x:(victim.position.x-position.x)/dist(position,victim.position),z:(victim.position.z-position.z)/dist(position,victim.position)}:{x:0,z:1},until:this.time+1};this.vaults++;
      this.events.push({type:'spell',...spell,phase:'dash',duration:Math.max(.03,(dist(position,victim.position)-PLAYER_RADIUS-victim.radius)/S.E.dashSpeed)});
      this.feedback='Salto · alcançando o alvo';
    }else{
      const duration=key==='Q'?S.Q.castTime:S.R.channel;
      this.casting={...spell,until:this.time+duration};this.events.push({type:'spell',...spell,phase:key==='R'?'channel':'cast',duration});this.feedback=key==='R'?'Chamando Valor…':'Investida Anuviante';
    }
    return true;
  }
  interruptSkills(){this.casting=null;this.dash=null;this.queued=null;this.events.push({type:'cancel-spell'});}
  move(point){if(this.casting?.key==='R')this.interruptSkills();this.queued=null;super.move(point);}
  stop(){if(this.casting?.key==='R')this.interruptSkills();this.queued=null;super.stop();}
  attackMove(point,position){if(this.casting?.key==='R')this.interruptSkills();super.attackMove(point,position);}
  attackTarget(id){if(this.casting?.key==='R')this.interruptSkills();super.attackTarget(id);}
  takeDamage(amount){super.takeDamage(amount);if(amount>0){if(this.casting?.key==='R'){this.interruptSkills();this.cooldowns.R=this.time+S.R.cooldown;}if(this.valor)this.valorSlowedUntil=this.time+S.R.slowDuration;}if(this.playerHealth<=0){this.interruptSkills();this.valor=false;this.acceptSkills=false;}}
  endAttacks(){super.endAttacks();this.acceptSkills=false;this.queued=null;this.valor=false;if(this.casting?.key==='R')this.interruptSkills();}
  resetVaultPractice(){this.cooldowns.E=this.time;this.mana=this.maxMana;this.queued=null;}
  vaultContact(spell,victim,position,impactTime,enemyPoint,approach){
    Object.assign(victim.position,enemyPoint);if(victim.vaultDash)victim.vaultDash.interruptedAt=impactTime;
    const until=impactTime+S.E.knockbackDuration;
    victim.displacement={from:copy(enemyPoint),to:{x:enemyPoint.x+approach.x*S.E.knockback,z:enemyPoint.z+approach.z*S.E.knockback},startedAt:impactTime,duration:S.E.knockbackDuration};
    victim.stunUntil=Math.max(victim.stunUntil??0,until);victim.slowStartsAt=until;victim.slowUntil=until+S.E.slowDuration;victim.slowAmount=S.E.slow;victim.quinnSlow=true;
    this.spellDamage(victim,S.E.damage[spell.rank-1]+S.E.bonusADRatio*this.bonusAD,spell);this.mark(victim);
    this.events.push({type:'vault-impact',targetId:victim.id,time:impactTime,position:copy(enemyPoint),spellId:spell.id});
    const end={x:enemyPoint.x-approach.x*S.E.reboundDistance,z:enemyPoint.z-approach.z*S.E.reboundDistance},duration=Math.max(.04,dist(position,end)/S.E.reboundSpeed);
    this.dash={...spell,phase:'rebound',origin:copy(position),end,startedAt:impactTime,until:impactTime+duration};
    this.events.push({type:'spell',...spell,phase:'rebound',origin:copy(position),point:copy(enemyPoint),duration});this.feedback='Salto · recuando';
  }
  update(dt,position,moveTarget,speed,options={}){
    if(dt<=0)return false;const initial=copy(position);let left=dt;
    while(left>1e-9){const step=Math.min(left,1/240);this.step(step,position,moveTarget,speed,options);left-=step;}
    return dist(initial,position)>.001;
  }
  step(dt,position,moveTarget,speed,options){
    const beforeTime=this.time,oldPosition=copy(position),locked=this.busy;
    this.playerPosition=copy(position);
    this.attackSpeed=Math.min(3,this.baseAttackSpeed+(this.time<this.heightenedUntil&&this.ranks.W ? .668*S.W.attackSpeed[this.ranks.W-1]:0));
    super.update(dt,position,moveTarget,speed,{...options,allowActions:options.allowActions!==false&&!locked,allowStart:options.allowStart!==false&&!locked});
    this.mana=this.unlimitedMana?this.maxMana:Math.min(this.maxMana,this.mana+this.manaRegen*dt);
    for(const target of this.targets){
      const displacement=target.displacement;
      if(displacement){const t=Math.min(1,(this.time-displacement.startedAt)/displacement.duration);Object.assign(target.position,mix(displacement.from,displacement.to,t));if(t>=1)delete target.displacement;}
      if(target.quinnSlow&&this.time>=target.slowStartsAt){target.slowAmount=S.E.slow*Math.max(0,(target.slowUntil-this.time)/S.E.slowDuration);if(this.time>=target.slowUntil)target.quinnSlow=false;}
      if(!target.alive)target.quinnMarkUntil=0;
    }
    if(this.time>=this.passiveReadyAt&&this.acceptSkills&&!this.valor){
      const candidates=this.targets.filter(t=>t.alive&&dist(position,t.position)<=S.passive.range);
      const target=candidates.find(t=>t.id===this.activeTargetId)??candidates.sort((a,b)=>(a.kind==='champion'||!a.kind?0:1)-(b.kind==='champion'||!b.kind?0:1)||dist(position,a.position)-dist(position,b.position))[0];
      if(target){this.mark(target);this.passiveReadyAt=this.time+quinnHarrierCooldown(this.critChance);}
    }
    // Q moves only after its cast has ended; closest swept collision owns impact.
    for(let i=this.skillProjectiles.length-1;i>=0;i--){
      const p=this.skillProjectiles[i],from=copy(p.position),step=Math.min(S.Q.speed*dt,S.Q.range-p.travelled),end={x:from.x+p.direction.x*step,z:from.z+p.direction.z*step};
      const hit=this.targets.filter(t=>t.alive).map(t=>({target:t,t:firstContact(from,end,movingVictim(t,beforeTime),movingVictim(t,this.time),S.Q.radius+t.radius)})).filter(h=>h.t!=null).sort((a,b)=>a.t-b.t)[0];
      p.position=end;p.travelled+=step;
      if(hit){
        const center=mix(from,end,hit.t);
        for(const victim of this.targets)if(victim.alive&&(victim===hit.target||dist(center,victim.position)<=S.Q.explosionRadius+victim.radius))this.spellDamage(victim,S.Q.damage[p.rank-1]+S.Q.bonusADRatio[p.rank-1]*this.bonusAD+S.Q.apRatio*this.abilityPower,p);
        this.mark(hit.target);hit.target.nearsightUntil=this.time+S.Q.nearsight;hit.target.nearsightRange=S.Q.nearsightRange;
        this.events.push({type:'spell-impact',key:'Q',position:center,radius:S.Q.explosionRadius});this.skillProjectiles.splice(i,1);
      }else if(p.travelled>=S.Q.range)this.skillProjectiles.splice(i,1);
    }
    if(this.casting&&this.time+1e-8>=this.casting.until){
      const spell=this.casting;this.casting=null;
      if(spell.key==='Q'){const d=dist(spell.origin,spell.point)||1;this.skillProjectiles.push({...spell,position:copy(position),travelled:0,direction:{x:(spell.point.x-spell.origin.x)/d,z:(spell.point.z-spell.origin.z)/d}});}
      else{this.valor=true;this.feedback='Valor ativo · R ou ataque para usar Ataque do Céu';this.events.push({type:'spell',...spell,phase:'transform',duration:0});}
    }
    if(this.dash){
      const spell=this.dash;
      if(spell.phase==='dash'){
        const victim=this.target(spell.targetId);
        if(!victim?.alive||victim.generation!==spell.generation||this.time>=spell.until){this.dash=null;this.events.push({type:'cancel-spell'});Object.assign(moveTarget,position);}
        else{
          const a=movingVictim(victim,beforeTime),b=movingVictim(victim,this.time),d=dist(oldPosition,a),approach=d>1e-7?{x:(a.x-oldPosition.x)/d,z:(a.z-oldPosition.z)/d}:spell.fallback;
          const end=toward(oldPosition,a,Math.min(d,S.E.dashSpeed*dt)),hit=firstContact(oldPosition,end,a,b,PLAYER_RADIUS+victim.radius);
          Object.assign(position,hit==null?end:mix(oldPosition,end,hit));
          if(hit!=null)this.vaultContact(spell,victim,position,beforeTime+dt*hit,mix(a,b,hit),approach);
        }
      }else{
        const t=Math.min(1,(this.time-spell.startedAt)/(spell.until-spell.startedAt));Object.assign(position,mix(spell.origin,spell.end,t));
        if(t>=1){this.dash=null;this.feedback='Salto concluído · consuma a marca com um ataque';Object.assign(moveTarget,position);if(this.order.type==='stop'&&this.acceptSkills)this.order={type:'attack',targetId:spell.targetId};}
      }
    }
    if(!this.busy&&this.queued&&options.allowActions!==false){const next=this.queued;this.queued=null;if(this.time<=next.expires)this.castAbility(next.key,next.point,position,next.targetId);}
  }
  summary(time=this.time){return {...super.summary(time),skillCasts:this.skillCasts,skillHits:this.skillHits,harrierProcs:this.harrierProcs,vaults:this.vaults,skystrikes:this.skystrikes};}
}
