import {Combat} from './combat.js';
import {spellData} from './leblanc-data.js';

const copy=p=>({x:p.x,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const value=(key,name,rank)=>spellData[key].values[name][rank];
export function leblancRanks(level){
  const ranks={Q:0,W:0,E:0,R:0};
  for(const key of ['W','Q','E','W','W','R','W','Q','W','Q','R','Q','Q','E','E','R','E','E'].slice(0,level))ranks[key]++;
  return ranks;
}
// First intersection of a swept projectile with a circle; earliest hit wins,
// independent of target array order and of the renderer's frame rate.
function intersection(a,b,center,radius){
  const dx=b.x-a.x,dz=b.z-a.z,ox=a.x-center.x,oz=a.z-center.z;
  const c=ox*ox+oz*oz-radius*radius;if(c<=0)return 0;
  const aa=dx*dx+dz*dz;if(!aa)return null;
  const bb=2*(ox*dx+oz*dz),disc=bb*bb-4*aa*c;if(disc<0)return null;
  const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:null;
}

export class LeBlancCombat extends Combat {
  constructor(options={}){
    super({...options,champion:'leblanc'});
    this.ranks=leblancRanks(this.level);this.abilityPower=Math.max(0,Number(options.abilityPower)||0);
    this.unlimitedMana=options.unlimitedMana??true;
    const growth=.7025*(this.level-1)+.0175*(this.level*this.level-1);
    this.maxMana=400+25*growth;this.mana=this.maxMana;this.manaRegen=1.6+.16*growth;
    this.cooldowns={Q:0,W:0,E:0,R:0};this.lastBasic='Q';this.anchors={};
    this.casting=null;this.dash=null;this.queued=null;this.skillProjectiles=[];this.tethers=[];
    this.skillCasts=0;this.skillHits=0;this.markDetonations=0;this.roots=0;this.returns=0;
    this.acceptSkills=true;this.feedback='Q no alvo · W/E na direção do cursor · R imita a última habilidade';
  }
  get pending(){return super.pending||!!this.casting||!!this.dash||this.skillProjectiles.length>0||this.tethers.length>0;}
  get busy(){return !!this.casting||!!this.dash;}
  reject(message){this.feedback=message;return false;}
  abilityState(key){
    const anchor=this.anchors[key],remaining=Math.max(0,this.cooldowns[key]-this.time);
    return {rank:this.ranks[key],remaining,returning:!!anchor,returnRemaining:anchor?Math.max(0,anchor.until-this.time):0,
      label:key==='R'?`R · ${anchor?'W ↩':this.lastBasic}`:key,
      ready:!!this.ranks[key]&&(!!anchor||remaining===0)};
  }
  castAbility(key,point,position,targetId=null){
    if(!this.acceptSkills||this.playerHealth<=0||!validPoint(point)||!validPoint(position)||!['Q','W','E','R'].includes(key))return false;
    if(!this.ranks[key])return this.reject(`${key} ainda não aprendido neste nível`);
    // One buffered command, matching an input buffer rather than an entire
    // scripted combo. Repeated keys replace the pending command, never spam it.
    if(this.busy){this.queued={key,point:copy(point),targetId,expires:this.time+.8};this.feedback=`${key} aguardando o fim da conjuração`;return true;}
    const anchor=this.anchors[key];
    if(anchor&&this.time<anchor.until){
      if(this.time<anchor.readyAt){this.queued={key,point:copy(point),targetId,expires:anchor.readyAt+.2};return true;}
      this.cancel('spell');this.order={type:'stop'};this.queued=null;
      Object.assign(position,anchor.position);delete this.anchors[key];this.returns++;this.recordCommand(`${key}-return`);
      this.events.push({type:'blink',key,position:copy(position)},{type:'spell',key,ability:'W',returning:true,duration:.25,point:copy(position)});
      this.feedback=`${key}: retorno`;return true;
    }
    if(this.time+1e-8<this.cooldowns[key])return this.reject(`${key} em recarga`);
    const ability=key==='R'?this.lastBasic:key,rank=this.ranks[key];
    const mana=spellData[key].mana[rank-1]??0;
    if(!this.unlimitedMana&&this.mana<mana)return this.reject('Mana insuficiente');
    let victim=null;
    if(ability==='Q'){
      victim=this.target(targetId);
      if(!victim?.alive)return this.reject('Q precisa de um alvo sob o cursor');
      // Targeted cast calibration: center distance; do not add AA radii.
      if(distance(position,victim.position)>700)return this.reject('Q: alvo fora de alcance (700 u)');
      point=victim.position;
    }
    if(ability==='E'&&distance(position,point)<1e-7)return this.reject('E: aponte uma direção com o cursor');
    this.cancel('spell');this.order={type:'stop'};this.activeTargetId=null;this.queued=null;
    if(!this.unlimitedMana)this.mana-=mana;
    this.cooldowns[key]=this.time+spellData[key].cooldown[rank];
    if(key!=='R')this.lastBasic=key;
    this.recordCommand(key,point,victim?.id);this.skillCasts++;
    const spell={id:++this.serial,key,ability,rank,point:copy(point),origin:copy(position),targetId:victim?.id,generation:victim?.generation};
    this.feedback=`${key==='R'?'R → ':''}${ability}`;
    if(ability==='W'){
      const d=distance(position,point),scale=d>600?600/d:1;
      spell.end={x:position.x+(point.x-position.x)*scale,z:position.z+(point.z-position.z)*scale};
      spell.duration=Math.max(.001,distance(position,spell.end)/1450);spell.startedAt=this.time;spell.until=this.time+spell.duration;
      this.dash=spell;this.anchors[key]={position:copy(position),until:spell.until+4,readyAt:spell.until+.2};
      this.events.push({type:'spell',...spell,duration:spell.duration});
    }else{
      this.casting={...spell,until:this.time+.25};
      this.events.push({type:'spell',...spell,duration:.25});
    }
    return true;
  }
  move(point){this.queued=null;super.move(point);}
  stop(){this.queued=null;super.stop();}
  endAttacks(){super.endAttacks();this.acceptSkills=false;this.queued=null;}
  takeDamage(amount){super.takeDamage(amount);if(this.playerHealth<=0){this.casting=null;this.dash=null;this.queued=null;this.tethers=[];this.anchors={};this.acceptSkills=false;}}
  spellDamage(target,amount,spell=null){
    if(!target.alive)return;
    const marks=target.sigils??[];target.sigils=[];
    const bonus=marks.filter(m=>m.until>this.time&&m.generation===target.generation);
    this.markDetonations+=bonus.length;
    // The AA accuracy report must not count ability damage as attack hits.
    const hits=this.hits;super.damageTarget(target,Math.round(amount+bonus.reduce((s,m)=>s+m.damage,0)),false,spell?{spellId:spell.id,ability:spell.key}:{});this.hits=hits;this.skillHits++;
  }
  damageFor(spell,delayed=false){
    const {key,ability,rank}=spell,ap=this.abilityPower;
    if(key==='R')return value('R',ability==='W'?'RWBase':`R${ability}${delayed?2:1}Base`,rank)+ap*(ability==='W'?.9:delayed?(ability==='E'?.85:.8):.4);
    if(ability==='Q')return value('Q',delayed?'BaseMarkDamage':'BaseDamage',rank)+.4*ap;
    if(ability==='W')return value('W','BaseDamage',rank)+.9*ap;
    return value('E',delayed?'BaseDelayedDamage':'BaseInitialDamage',rank)+ap*(delayed?.85:.4);
  }
  projectileHit(spell,victim){
    this.spellDamage(victim,this.damageFor(spell),spell);
    if(!victim.alive)return;
    if(spell.ability==='Q')victim.sigils=[{key:spell.key,until:this.time+3.5,damage:this.damageFor(spell,true),generation:victim.generation}];
    else this.tethers.push({...spell,targetId:victim.id,generation:victim.generation,until:this.time+1.5});
  }
  update(dt,position,moveTarget,speed,options={}){
    if(dt<=0)return false;
    const locked=this.busy;
    const moved=super.update(dt,position,moveTarget,speed,{...options,allowActions:options.allowActions!==false&&!locked,allowStart:options.allowStart!==false&&!locked});
    this.mana=Math.min(this.maxMana,this.mana+dt*this.manaRegen);
    for(const [key,anchor] of Object.entries(this.anchors))if(this.time>=anchor.until)delete this.anchors[key];
    for(const target of this.targets){target.sigils=(target.sigils??[]).filter(m=>target.alive&&m.until>this.time&&m.generation===target.generation);if(!target.alive)target.rootUntil=0;}
    if(this.dash){
      const spell=this.dash,t=Math.min(1,(this.time-spell.startedAt)/spell.duration);
      position.x=spell.origin.x+(spell.end.x-spell.origin.x)*t;position.z=spell.origin.z+(spell.end.z-spell.origin.z)*t;
      if(t>=1){this.dash=null;Object.assign(moveTarget,position);
        for(const victim of this.targets)if(victim.alive&&distance(position,victim.position)<=220+victim.radius)this.spellDamage(victim,this.damageFor(spell),spell);
        this.events.push({type:'spell-impact',key:spell.key,position:copy(position),radius:220});
      }
    }
    // Tick existing missiles before creating new ones: a cast does not receive
    // a free frame of projectile travel at its release.
    for(let i=this.skillProjectiles.length-1;i>=0;i--){
      const spell=this.skillProjectiles[i],from=copy(spell.position);
      if(spell.ability==='Q'){
        const victim=this.target(spell.targetId);
        if(!victim?.alive||victim.generation!==spell.generation){this.skillProjectiles.splice(i,1);continue;}
        const d=distance(from,victim.position),step=dt*2000;
        if(d<=step){this.projectileHit(spell,victim);this.skillProjectiles.splice(i,1);}
        else{spell.position.x+=(victim.position.x-from.x)*step/d;spell.position.z+=(victim.position.z-from.z)*step/d;}
      }else{
        const step=Math.min(1750*dt,950-spell.travelled),end={x:from.x+spell.direction.x*step,z:from.z+spell.direction.z*step};
        const hits=this.targets.filter(t=>t.alive).map(target=>({target,t:intersection(from,end,target.position,55+target.radius)})).filter(h=>h.t!==null).sort((a,b)=>a.t-b.t);
        spell.position=end;spell.travelled+=step;
        if(hits.length){this.projectileHit(spell,hits[0].target);this.skillProjectiles.splice(i,1);}
        else if(spell.travelled>=950)this.skillProjectiles.splice(i,1);
      }
    }
    if(this.casting&&this.time+1e-8>=this.casting.until){
      const spell=this.casting;this.casting=null;
      const d=distance(spell.origin,spell.point)||1;
      this.skillProjectiles.push({...spell,position:copy(position),travelled:0,direction:{x:(spell.point.x-spell.origin.x)/d,z:(spell.point.z-spell.origin.z)/d}});
    }
    for(let i=this.tethers.length-1;i>=0;i--){
      const tether=this.tethers[i],victim=this.target(tether.targetId);
      if(!victim?.alive||victim.generation!==tether.generation||this.playerHealth<=0||distance(position,victim.position)>865){this.tethers.splice(i,1);continue;}
      if(this.time+1e-8>=tether.until){this.spellDamage(victim,this.damageFor(tether,true),tether);if(victim.alive){victim.rootUntil=this.time+1.5;this.roots++;}this.tethers.splice(i,1);}
    }
    if(this.queued&&!this.busy){const queued=this.queued;if(queued.expires<this.time||options.allowStart===false)this.queued=null;else if(!this.anchors[queued.key]||this.time>=this.anchors[queued.key].readyAt){this.queued=null;this.castAbility(queued.key,queued.point,position,queued.targetId);}}
    return moved; // Dash is an animation state, not running locomotion.
  }
  summary(activeTime=this.time){return {...super.summary(activeTime),skillCasts:this.skillCasts,skillHits:this.skillHits,markDetonations:this.markDetonations,roots:this.roots,returns:this.returns};}
}
