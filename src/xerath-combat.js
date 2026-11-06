import {Combat} from './combat.js';
import {XERATH as X,xerathRanks,xerathPassiveMana,xerathStun} from './xerath-data.js';

const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const direction=(a,b)=>{const d=dist(a,b);return d>1e-8?{x:(b.x-a.x)/d,z:(b.z-a.z)/d}:{x:0,z:-1};};
const endpoint=(a,b,r)=>{const d=direction(a,b);return {x:a.x+d.x*r,z:a.z+d.z*r};};
const within=(a,b,r)=>mix(a,b,Math.min(1,r/(dist(a,b)||1)));
// Earliest collision between two moving points, expanded by their radii.
function collision(a,b,c,d,r){
  const x=a.x-c.x,z=a.z-c.z,vx=b.x-a.x-d.x+c.x,vz=b.z-a.z-d.z+c.z;
  const C=x*x+z*z-r*r;if(C<=0)return 0;
  const A=vx*vx+vz*vz,B=2*(x*vx+z*vz),D=B*B-4*A*C;
  if(A<1e-12||D<0)return null;const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:null;
}
function lineHits(s,p,r){
  const v=direction(s.origin,s.end),dx=p.x-s.origin.x,dz=p.z-s.origin.z;
  const along=dx*v.x+dz*v.z,across=dx*-v.z+dz*v.x;
  return Math.hypot(along-clamp(along,0,dist(s.origin,s.end)),across-clamp(across,-s.width/2,s.width/2))<=r;
}

export class XerathCombat extends Combat {
  constructor(options={}){
    super({...options,champion:'xerath'});this.profile={...this.profile,...X.base};this.range=X.base.attackRange;
    this.ranks=xerathRanks(this.level);this.abilityPower=Math.max(0,Number(options.abilityPower)||0);this.abilityHaste=Math.max(0,Number(options.abilityHaste)||0);
    const growth=.7025*(this.level-1)+.0175*(this.level*this.level-1);
    this.attackDamage=X.base.attackDamage+X.base.attackDamageGrowth*growth;
    this.maxMana=X.base.mana+X.base.manaGrowth*growth;this.mana=this.maxMana;this.manaRegen=X.base.manaRegen+X.base.manaRegenGrowth*growth;
    this.unlimitedMana=options.unlimitedMana??true;this.cooldowns={Q:0,W:0,E:0,R:0};this.passiveReadyAt=0;
    this.charge=null;this.channel=null;this.casting=null;this.impacts=[];this.skillProjectiles=[];this.aimPoint={x:0,z:-1000};this.acceptSkills=true;
    this.skillCasts=0;this.skillHits=0;this.centerHits=0;this.stuns=0;this.rShots=0;this.rChannels=0;this.passiveProcs=0;
    this.abilityStats=Object.fromEntries(['Q','W','E','R'].map(k=>[k,{casts:0,hits:0,misses:0,targets:0,centerHits:0}]));
    this.feedback='Segure Q para alcance · W no centro · E intercepta · R e recasts para disparar';
  }
  get busy(){return !!this.casting||!!this.channel;}
  get pending(){return super.pending||!!this.charge||this.busy||this.impacts.length>0||this.skillProjectiles.length>0;}
  get qRange(){return X.Q.minRange+(X.Q.range-X.Q.minRange)*clamp(this.charge?(this.time-this.charge.startedAt)/X.Q.chargeTime:0,0,1);}
  get speedMultiplier(){return this.charge?1-clamp(.2+(this.time-this.charge.startedAt)*.1,.2,.4):1;}
  get threats(){return this.visibleThreats();}
  cooldown(key){return (X[key]?.cooldown[this.ranks[key]-1]??0)*100/(100+this.abilityHaste);}
  abilityState(key){
    const remaining=Math.max(0,this.cooldowns[key]-this.time),charging=key==='Q'&&!!this.charge,channeling=key==='R'&&!!this.channel;
    const recast=channeling?Math.max(0,this.channel.readyAt-this.time):0;
    return {rank:this.ranks[key],remaining:channeling?recast:remaining,charging,channeling,charges:channeling?this.channel.shots:undefined,
      ready:!!this.ranks[key]&&this.acceptSkills&&this.playerHealth>0&&(charging||(channeling?recast<=1e-8:remaining<=1e-8&&!this.busy&&!this.charge)),
      label:charging?`Q · ${Math.round(this.qRange)} u`:channeling?`R · ${this.channel.shots} disparos`:key,returnRemaining:channeling?Math.max(0,this.channel.until-this.time):0};
  }
  updateAim(point){if(valid(point)){this.aimPoint=copy(point);if(this.charge)this.charge.point=copy(point);}}
  reject(message){this.feedback=message;return false;}
  emitSpell(spell,phase,duration=0){this.events.push({type:'spell',...spell,ability:spell.key,phase,duration,time:this.time});}
  newSpell(key,point,position){return {id:++this.serial,key,ability:key,origin:copy(position),point:copy(point),startedAt:this.time};}
  commit(spell){this.skillCasts++;this.abilityStats[spell.key].casts++;this.events.push({type:'spell-telegraph',...this.shape(spell)});}
  shape(spell){return {id:spell.id,key:spell.key,kind:spell.kind,origin:copy(spell.origin),point:copy(spell.point),end:copy(spell.end??spell.point),width:spell.width,radius:spell.radius,startedAt:spell.startedAt,impactAt:spell.impactAt,expiresAt:spell.impactAt,speed:spell.speed,...(spell.position?{position:copy(spell.position)}:{})};}
  visibleThreats(){return [...this.impacts,...(this.casting?.key==='E'?[this.casting]:[]),...this.skillProjectiles].map(s=>this.shape(s));}
  castAbility(key,point,position,targetId=null){
    if(!this.acceptSkills||this.playerHealth<=0||!valid(point)||!valid(position)||!X[key])return false;
    this.playerPosition=copy(position);this.updateAim(point);
    if(key==='Q'&&this.charge)return this.releaseAbility(key,point,position);
    if(key==='R'&&this.channel)return this.fireR(point);
    if(!this.ranks[key])return this.reject(`${key} ainda não aprendido`);
    if(this.busy||this.charge)return this.reject('Conclua ou cancele a habilidade atual');
    if(this.cooldowns[key]>this.time+1e-8)return this.reject(`${key} em recarga`);
    const cost=X[key].mana[this.ranks[key]-1];if(!this.unlimitedMana&&this.mana<cost)return this.reject('Mana insuficiente');
    if(!this.unlimitedMana)this.mana-=cost;
    this.cancel('spell');this.recordCommand(key,point,targetId);this.feedback=X[key].name;
    const spell=this.newSpell(key,point,position);spell.cost=cost;
    if(key==='Q'){
      this.charge={...spell,until:this.time+X.Q.maxHold};this.emitSpell(this.charge,'charge',.125);return true;
    }
    this.order={type:'stop'};this.activeTargetId=null;this.cooldowns[key]=this.time+this.cooldown(key);
    if(key==='R'){
      this.channel={...spell,until:this.time+X.R.duration,shots:X.R.shots[this.ranks.R-1],maxShots:X.R.shots[this.ranks.R-1],readyAt:this.time+X.R.startup,stacks:0,shotsFired:0};
      this.rChannels++;this.emitSpell(this.channel,'channel',X.R.startup);return true;
    }
    this.casting={...spell,until:this.time+X[key].castTime};
    if(key==='W'){
      Object.assign(spell,{kind:'circle',point:within(position,point,X.W.range),radius:X.W.radius,impactAt:this.time+X.W.delay});this.impacts.push(spell);
    }else{
      Object.assign(spell,{kind:'missile',end:endpoint(position,point,X.E.range),radius:X.E.radius,speed:X.E.speed,impactAt:this.time+X.E.castTime+X.E.range/X.E.speed});
      this.casting={...this.casting,...spell};
    }
    this.commit(spell);this.emitSpell(spell,'cast',X[key].castTime);return true;
  }
  releaseAbility(key,point,position){
    if(key!=='Q'||!this.charge||!valid(point)||!valid(position))return false;
    const spell={...this.charge,origin:copy(position),point:copy(point),startedAt:this.time,kind:'line',width:X.Q.width,end:endpoint(position,point,this.qRange),impactAt:this.time+X.Q.castTime};
    this.charge=null;this.cooldowns.Q=this.time+this.cooldown('Q');this.order={type:'stop'};this.activeTargetId=null;
    this.casting={...spell,until:spell.impactAt};this.impacts.push(spell);this.commit(spell);this.emitSpell(spell,'release',X.Q.castTime);return true;
  }
  cancelCharge(reason='cancel'){
    if(!this.charge)return false;const charge=this.charge;this.charge=null;this.cooldowns.Q=this.time+this.cooldown('Q');
    this.mana=Math.min(this.maxMana,this.mana+charge.cost*X.Q.refund);this.emitSpell({...charge,reason},'cancel');return true;
  }
  fireR(point){
    const channel=this.channel;if(!channel||this.time+1e-8<channel.readyAt||!channel.shots)return this.reject('R: aguarde o próximo disparo');
    const spell={...this.newSpell('R',within(channel.origin,point,X.R.range),channel.origin),kind:'circle',radius:X.R.radius,impactAt:this.time+X.R.delay,channel};
    channel.shots--;channel.shotsFired++;channel.readyAt=this.time+X.R.shotCooldown;this.rShots++;this.recordCommand('R',point);
    this.impacts.push(spell);this.commit(spell);this.emitSpell(spell,'shot',X.R.shotCooldown);
    // Keep the last recoil animation until the shot lands; the channel then ends.
    if(!channel.shots)channel.until=Math.min(channel.until,spell.impactAt);return true;
  }
  endChannel(reason='cancel'){
    if(!this.channel)return;const channel=this.channel;this.channel=null;
    if(!channel.shotsFired){this.mana=Math.min(this.maxMana,this.mana+channel.cost*X.R.refund);this.cooldowns.R=this.time+this.cooldown('R')*(1-X.R.refund);}
    this.emitSpell({...channel,reason},'end',.25);
  }
  move(point){this.endChannel('move');super.move(point);}
  stop(){this.cancelCharge('stop');this.endChannel('stop');super.stop();}
  attackMove(point,position){this.cancelCharge('attack');this.endChannel('attack');super.attackMove(point,position);}
  attackTarget(id){this.cancelCharge('attack');this.endChannel('attack');super.attackTarget(id);}
  endAttacks(){super.endAttacks();this.acceptSkills=false;this.cancelCharge('end');this.endChannel('end');}
  takeDamage(amount){super.takeDamage(amount);if(this.playerHealth<=0){this.acceptSkills=false;this.cancelCharge('defeated');this.endChannel('defeated');}}
  damageFor(key){return X[key].damage[this.ranks[key]-1]+X[key].apRatio*this.abilityPower;}
  damageTarget(target,amount,priority=false,metadata={}){
    if(!target.alive)return;
    if(this.time>=this.passiveReadyAt){const champion=!target.kind||target.kind==='champion';this.mana=Math.min(this.maxMana,this.mana+xerathPassiveMana(this.level)*(champion?2:1));this.passiveReadyAt=this.time+X.passive.cooldown;this.passiveProcs++;}
    super.damageTarget(target,amount,priority,metadata);if(!target.alive)this.passiveReadyAt=Math.max(this.time,this.passiveReadyAt-X.passive.killRefund);
  }
  spellDamage(target,amount,spell){
    const hits=this.hits;super.damageTarget(target,Math.round(amount),false,{spellId:spell.id,ability:spell.key});this.hits=hits;this.skillHits++;
    if(!target.alive)this.passiveReadyAt=Math.max(this.time,this.passiveReadyAt-X.passive.killRefund);
  }
  resolve(spell,targets,centerHits=[]){
    const targetIds=targets.map(t=>t.id),hit=targets.length>0,stats=this.abilityStats[spell.key];stats[hit?'hits':'misses']++;stats.targets+=targets.length;stats.centerHits+=centerHits.length;
    const event={...this.shape(spell),ability:spell.key,hit,targetIds,centerHits,time:this.time};
    this.events.push({type:'spell-impact',...event},{type:'spell-resolved',...event});
  }
  targetPosition(target,fraction){return target.previousPosition?mix(target.previousPosition,target.position,fraction):target.position;}
  impact(spell,fraction){
    const targets=this.targets.filter(t=>t.alive&&(spell.kind==='line'?lineHits(spell,this.targetPosition(t,fraction),t.radius):dist(this.targetPosition(t,fraction),spell.point)<=spell.radius+t.radius));
    const centers=[];const ramp=spell.key==='R'?spell.channel.stacks*(X.R.rampDamage[this.ranks.R-1]+X.R.rampRatio*this.abilityPower):0;
    for(const target of targets){
      let damage=this.damageFor(spell.key)+ramp;
      if(spell.key==='W'){
        const center=dist(this.targetPosition(target,fraction),spell.point)<=X.W.centerRadius+target.radius;
        if(center){centers.push(target.id);damage*=X.W.centerMultiplier;this.centerHits++;}
        const slow=center?X.W.centerSlow[this.ranks.W-1]:X.W.slow;
        Object.assign(target,{slowAmount:slow,slowStartsAt:this.time,slowUntil:this.time+X.W.slowDuration,xerathSlow:{start:this.time,initial:slow,generation:target.generation}});
      }
      this.spellDamage(target,damage,spell);
    }
    if(spell.key==='R'&&targets.some(t=>!t.kind||t.kind==='champion'))spell.channel.stacks++;
    this.resolve(spell,targets,centers);
  }
  update(dt,position,moveTarget,speed,options={}){
    if(dt<=0)return false;let moving=false,elapsed=0;
    while(elapsed<dt-1e-9){const step=Math.min(1/120,dt-elapsed);moving=this.step(step,position,moveTarget,speed,options,elapsed/dt,(elapsed+step)/dt)||moving;elapsed+=step;}return moving;
  }
  step(dt,position,moveTarget,speed,{allowStart=true,allowActions=true},fromFraction,toFraction){
    const before=this.time,moving=super.update(dt,position,moveTarget,speed,{allowStart:allowStart&&!this.busy&&!this.charge,allowActions:allowActions&&!this.busy});
    this.playerPosition=copy(position);this.mana=this.unlimitedMana?this.maxMana:Math.min(this.maxMana,this.mana+dt*this.manaRegen);
    if(this.charge){this.charge.origin=copy(position);if(this.time+1e-8>=this.charge.until)this.cancelCharge('expired');}
    if(this.casting&&this.time+1e-8>=this.casting.until){
      const spell=this.casting;this.casting=null;
      if(spell.key==='E')this.skillProjectiles.push({...spell,spell,position:copy(spell.origin),dir:direction(spell.origin,spell.end),travelled:0,range:X.E.range,launchedAt:spell.until});
    }
    for(let i=this.impacts.length-1;i>=0;i--){const spell=this.impacts[i];if(this.time+1e-8>=spell.impactAt){const f=clamp((spell.impactAt-before)/dt,0,1);this.impact(spell,fromFraction+(toFraction-fromFraction)*f);this.impacts.splice(i,1);}}
    for(let i=this.skillProjectiles.length-1;i>=0;i--){
      const missile=this.skillProjectiles[i],travel=Math.min(missile.range-missile.travelled,missile.speed*Math.max(0,this.time-Math.max(before,missile.launchedAt))),a=copy(missile.position),b={x:a.x+missile.dir.x*travel,z:a.z+missile.dir.z*travel};
      const launchFraction=fromFraction+(toFraction-fromFraction)*clamp((missile.launchedAt-before)/dt,0,1);
      let victim=null,earliest=Infinity;
      for(const target of this.targets.filter(t=>t.alive)){const t=collision(a,b,this.targetPosition(target,launchFraction),this.targetPosition(target,toFraction),missile.radius+target.radius);if(t!==null&&t<earliest){victim=target;earliest=t;}}
      if(victim){
        missile.position=mix(a,b,earliest);missile.travelled+=travel*earliest;
        this.spellDamage(victim,this.damageFor('E'),missile);victim.stunUntil=Math.max(victim.stunUntil??0,this.time+xerathStun(missile.travelled));this.stuns++;
        this.resolve({...missile,point:copy(missile.position)},[victim]);this.skillProjectiles.splice(i,1);
      }else{
        missile.position=b;missile.travelled+=travel;
        if(missile.travelled>=missile.range-1e-7){this.resolve({...missile,point:copy(b)},[]);this.skillProjectiles.splice(i,1);}
      }
    }
    if(this.channel&&this.time+1e-8>=this.channel.until)this.endChannel('expired');
    for(const target of this.targets){const s=target.xerathSlow;if(s&&s.generation===target.generation&&target.slowUntil>this.time)target.slowAmount=Math.max(X.W.slow,s.initial*Math.pow(.8,(this.time-s.start)/.25));else if(s)delete target.xerathSlow;}
    return moving;
  }
  summary(activeTime=this.time){return {...super.summary(activeTime),skillCasts:this.skillCasts,skillHits:this.skillHits,centerHits:this.centerHits,stuns:this.stuns,rShots:this.rShots,rChannels:this.rChannels,passiveProcs:this.passiveProcs,mana:Math.round(this.mana),maxMana:Math.round(this.maxMana),abilityStats:structuredClone(this.abilityStats)};}
}
