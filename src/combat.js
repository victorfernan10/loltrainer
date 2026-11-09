import {advance} from './simulation.js';
import {champions,championRange} from './champions.js';

export const PLAYER_RADIUS=65;
export const ATTACK_DAMAGE=60;
export const TARGET_HEALTH=600;
// Local Kayle snapshot: basicAttack.castTime / totalTime = .3 / 1.55.
// The melee range preserves this trainer's 150 u calibration; passive ranges
// 525 / 625 and missile speed 2250 come from tools/kayle-root.json.
export const WINDUP_FRACTION=.3/1.55;
export const attackRange=level=>level>=16?625:level>=6?525:150;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const copy=p=>({x:p.x,z:p.z});
export function inAttackRange(position,target,range){return target.alive&&distance(position,target.position)<=range+PLAYER_RADIUS+target.radius+1e-7;}
export function selectAttackMoveTarget(position,cursor,targets,range,priority='cursor'){
  const candidates=targets.filter(t=>inAttackRange(position,t,range));
  const anchor=priority==='champion'?position:cursor;
  return candidates.sort((a,b)=>distance(a.position,anchor)-distance(b.position,anchor)||a.id.localeCompare(b.id))[0]??null;
}

export class Combat {
  constructor({level=6,attackSpeed=1.5,priority='cursor',targets,circuit=false,difficulty=2,champion='kayle',advanced=false,random=Math.random}={}){
    this.champion=champion;this.profile=champions[champion]??champions.kayle;this.ranged=champion!=='kayle'||level>=6;this.level=level;this.attackSpeed=Math.max(.5,Math.min(3,attackSpeed));this.range=championRange(champion,level);this.priority=priority;
    this.advancedCircuit=advanced&&circuit;this.random=random;
    this.targets=(targets??(this.advancedCircuit?[{id:'ryze-1',position:{x:-320,z:-230}},{id:'ryze-2',position:{x:350,z:-180}},{id:'ryze-3',position:{x:0,z:-440}}]:[{id:'ryze-1',position:{x:-260,z:-240}},{id:'ryze-2',position:{x:390,z:-200}}])).map(t=>({...t,position:copy(t.position),radius:t.radius??65,health:t.maxHealth??TARGET_HEALTH,maxHealth:t.maxHealth??TARGET_HEALTH,alive:true,generation:0,respawnAt:Infinity}));
    this.time=0;this.readyAt=0;this.windup=null;this.order={type:'stop'};this.events=[];this.bolts=[];this.serial=0;
    this.playerHealth=1000;this.maxPlayerHealth=1000;this.damage=0;this.hits=0;this.started=0;this.released=0;this.cancelled=0;this.kills=0;this.readyIdleTime=0;
    this.animationUntil=0;this.activeTargetId=null;
    this.circuit=circuit;this.priorityWindow=({1:5,2:3.5,3:2.5})[difficulty]||3.5;
    this.markRequired=this.advancedCircuit&&difficulty===3?3:2;this.stepRequired=this.advancedCircuit?({1:45,2:70,3:95})[difficulty]??70:0;
    if(this.advancedCircuit)this.priorityWindow=Math.max(this.priorityWindow,(this.markRequired-1)/this.attackSpeed+(this.markRequired-1)*this.stepRequired/330+this.profile.windupFraction/this.attackSpeed+.6);
    this.markReleasePosition=null;this.stationaryReleases=0;this.offTargetReleases=0;this.circuitHint='';
    this.markedId=this.targets[0]?.id;this.markedUntil=this.priorityWindow;this.markedProgress=0;this.completedMarks=0;this.missedMarks=0;this.priorityHits=0;
    this.lastReleasePosition=null;this.kiteSteps=0;this.kiteOpportunities=0;
    this.commands=0;this.changedCommands=0;this.lastCommand=null;
    this.eReadyAt=0;this.wReadyAt=0;this.boostUntil=0;this.empowered=false;this.eUses=0;this.wUses=0;this.resets=0;
  }
  recordCommand(kind,point=null,id=null){
    this.commands++;const last=this.lastCommand;
    if(!last||last.kind!==kind||last.id!==id||(point&&(!last.point||distance(last.point,point)>=30))){this.changedCommands++;this.lastCommand={kind,id,point:point?copy(point):null};}
  }
  castE(){
    if(this.champion!=='kayle'||this.time<this.eReadyAt||this.playerHealth<=0)return false;
    this.recordCommand('E');this.eUses++;if(this.readyAt>this.time)this.resets++;
    this.readyAt=this.time;this.eReadyAt=this.time+5;this.empowered=true;
    if(this.windup)this.windup.empowered=true;
    this.events.push({type:'empower',attack:this.windup?{...this.windup,windup:this.windup.releaseAt-this.windup.startedAt,ranged:this.ranged}:null});return true;
  }
  castW(){
    if(this.champion!=='kayle'||this.time<this.wReadyAt||this.playerHealth<=0)return false;
    this.recordCommand('W');this.wUses++;this.wReadyAt=this.time+10;this.boostUntil=this.time+2;
    this.playerHealth=Math.min(this.maxPlayerHealth,this.playerHealth+60);this.events.push({type:'boost'});return true;
  }
  get speedMultiplier(){return this.time<this.boostUntil?1.3:1;}
  rotateMark(completed=false){
    if(completed)this.completedMarks++;else this.missedMarks++;
    const index=this.targets.findIndex(t=>t.id===this.markedId);
    const alternatives=this.targets.filter(t=>t.alive&&t.id!==this.markedId);
    this.markedId=this.advancedCircuit&&alternatives.length?alternatives[Math.floor(this.random()*alternatives.length)].id:this.targets.find((t,i)=>i>index&&t.alive)?.id??alternatives[0]?.id??this.markedId;
    this.markedProgress=0;this.markReleasePosition=null;this.circuitHint='';this.markedUntil=this.time+this.priorityWindow;
  }
  get pending(){return !!this.windup||this.bolts.length>0;}
  target(id){return this.targets.find(t=>t.id===id);}
  cancel(reason='move'){
    if(this.windup){this.cancelled++;this.events.push({type:'cancel',reason,id:this.windup.id});this.windup=null;}
    this.animationUntil=0;
  }
  move(point){this.recordCommand('move',point);this.cancel();this.order={type:'move',point:copy(point)};this.activeTargetId=null;}
  stop(){this.recordCommand('stop');this.cancel('stop');this.order={type:'stop'};this.activeTargetId=null;}
  rangeFor(target){return this.range;}
  selectTarget(position,cursor){
    const anchor=this.priority==='champion'?position:cursor;
    return this.targets.filter(t=>inAttackRange(position,t,this.rangeFor(t))).sort((a,b)=>distance(a.position,anchor)-distance(b.position,anchor)||a.id.localeCompare(b.id))[0]??null;
  }
  attackPayload(attack,target){return {damage:Math.round(this.attackDamage??ATTACK_DAMAGE)*(this.empowered?2:1),metadata:{attackId:attack.id,isBasicAttack:true}};}
  attackMove(point,position){
    const next=this.selectTarget(position,point);
    this.recordCommand('attackMove',next?null:point,next?.id??null);
    if(this.windup&&next?.id!==this.windup.targetId)this.cancel('retarget');
    this.order={type:'attackMove',point:copy(point)};
    this.activeTargetId=next?.id??null;
  }
  attackTarget(id){
    if(!this.target(id)?.alive)return;
    this.recordCommand('attack',null,id);
    if(this.windup&&this.windup.targetId!==id)this.cancel('retarget');
    this.order={type:'attack',targetId:id};this.activeTargetId=id;
  }
  endAttacks(){this.order={type:'stop'};}
  takeDamage(amount){
    this.playerHealth=Math.max(0,this.playerHealth-amount);
    if(this.playerHealth===0){this.cancel('defeated');this.order={type:'stop'};}
  }
  damageTarget(target,amount,priorityHit=false,metadata={}){
    const absorbed=Math.min(target.shield??0,amount);target.shield=Math.max(0,(target.shield??0)-absorbed);amount-=absorbed;
    const applied=Math.min(target.health,amount);target.health-=applied;this.damage+=applied;this.hits++;
    this.events.push({type:'hit',targetId:target.id,amount:applied,...metadata});
    if(priorityHit)this.priorityHits++;
    if(target.health<=0){target.alive=false;target.respawnAt=this.time+1.2;this.kills++;this.events.push({type:'kill',targetId:target.id});}
  }
  beginAttack(target){
    const period=1/this.attackSpeed,id=++this.serial;
    this.windup={id,targetId:target.id,generation:target.generation,startedAt:this.time,releaseAt:this.time+period*this.profile.windupFraction,period,empowered:this.empowered};
    this.started++;this.activeTargetId=target.id;this.animationTargetId=target.id;this.animationUntil=this.time+period;
    this.events.push({type:'start',...this.windup,windup:period*this.profile.windupFraction,ranged:this.ranged});
  }
  update(dt,position,moveTarget,speed,{allowStart=true,allowActions=true}={}){
    if(dt<=0)return false;
    this.time+=dt;
    if(this.circuit&&allowStart&&this.time>=this.markedUntil)this.rotateMark();
    for(const target of this.targets){if(!target.alive&&this.time>=target.respawnAt){target.alive=true;target.health=target.maxHealth;target.generation++;}}
    for(let i=this.bolts.length-1;i>=0;i--){const bolt=this.bolts[i],victim=this.target(bolt.targetId);bolt.remaining-=dt;
      if(!victim?.alive||victim.generation!==bolt.generation){this.bolts.splice(i,1);continue;}
      if(bolt.remaining<=0){this.damageTarget(victim,bolt.damage,bolt.priorityHit,bolt.metadata);this.bolts.splice(i,1);}
    }
    const wasWinding=!!this.windup;
    if(this.windup){
      const attack=this.windup,victim=this.target(attack.targetId);
      if(!victim?.alive||victim.generation!==attack.generation)this.cancel('target-lost');
      else if(this.time+1e-8>=attack.releaseAt){
        this.windup=null;this.released++;this.readyAt=attack.startedAt+attack.period;
        const payload=this.attackPayload(attack,victim),damage=payload.damage,priorityHit=this.circuit&&victim.id===this.markedId;
        this.empowered=false;
        if(this.lastReleasePosition){this.kiteOpportunities++;if(distance(position,this.lastReleasePosition)>=60)this.kiteSteps++;}
        this.lastReleasePosition=copy(position);
        if(priorityHit){
          const spaced=!this.markReleasePosition||distance(position,this.markReleasePosition)+1e-8>=this.stepRequired;
          if(spaced){this.markedProgress++;this.markReleasePosition=copy(position);this.circuitHint='';if(this.markedProgress>=this.markRequired)this.rotateMark(true);}
          else{this.stationaryReleases++;this.circuitHint=`Reposicione ${this.stepRequired} u para pontuar o próximo disparo`;}
        }else if(this.advancedCircuit){this.offTargetReleases++;this.circuitHint='Troque para o alvo marcado';}
        this.events.push({type:'release',id:attack.id,targetId:victim.id,...payload.metadata});
        if(this.ranged){const duration=distance(position,victim.position)/this.profile.missileSpeed;this.bolts.push({id:attack.id,targetId:victim.id,generation:victim.generation,origin:copy(position),duration,remaining:duration,damage,priorityHit,metadata:payload.metadata});}
        else this.damageTarget(victim,damage,priorityHit,payload.metadata);
      }
      // Never translate the actor during the preparation/release frame.
      if(wasWinding)return false;
    }
    if(this.playerHealth<=0||!allowActions)return false;
    const direct=this.order.type==='attack'?this.target(this.order.targetId):null;
    const selected=direct?.alive?direct:this.order.type==='attackMove'?this.selectTarget(position,this.order.point):null;
    this.activeTargetId=selected?.id??null;
    if(selected&&inAttackRange(position,selected,this.rangeFor(selected))){
      if(allowStart&&this.time+1e-8>=this.readyAt)this.beginAttack(selected);
      return false;
    }
    if(allowStart&&this.time>=this.readyAt&&this.targets.some(t=>inAttackRange(position,t,this.rangeFor(t))))this.readyIdleTime+=dt;
    if(direct?.alive){
      const d=distance(position,direct.position),remaining=Math.max(0,d-this.rangeFor(direct)-PLAYER_RADIUS-direct.radius+1);
      if(d>0){moveTarget.x=position.x+(direct.position.x-position.x)/d*remaining;moveTarget.z=position.z+(direct.position.z-position.z)/d*remaining;}
    }else if(this.order.type==='move'||this.order.type==='attackMove')Object.assign(moveTarget,this.order.point);
    else return false;
    const moving=advance(position,moveTarget,speed*this.speedMultiplier,dt);
    if(moving)this.animationUntil=0;
    return moving;
  }
  drainEvents(){return this.events.splice(0);}
  summary(activeTime=this.time){return {damage:this.damage,hits:this.hits,started:this.started,released:this.released,cancelled:this.cancelled,kills:this.kills,playerHealth:this.playerHealth,maxPlayerHealth:this.maxPlayerHealth,dps:activeTime>0?Math.round(this.damage/activeTime):0,readyIdleTime:Math.round(this.readyIdleTime*10)/10,circuit:this.circuit,advancedCircuit:this.advancedCircuit,markRequired:this.markRequired,stepRequired:this.stepRequired,stationaryReleases:this.stationaryReleases,offTargetReleases:this.offTargetReleases,completedMarks:this.completedMarks,missedMarks:this.missedMarks,priorityHits:this.priorityHits,kiteSteps:this.kiteSteps,kiteOpportunities:this.kiteOpportunities,apm:activeTime>0?Math.round(this.commands*60/activeTime):0,changedApm:activeTime>0?Math.round(this.changedCommands*60/activeTime):0,eUses:this.eUses,wUses:this.wUses,resets:this.resets};}
}
