import {advance,effectiveSpeed} from './simulation.js';
import {pointSegmentDistanceXZ,movingPointDistance,fullCastEndpoint} from './dodge-simulation.js';
import {YONE,yoneQCooldown,yoneQCast,yoneRating} from './yone-data.js';

const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const yoneSkills={
  yoneQ:{id:'yoneQ',champion:'Yone',key:'Q',name:'Aço Mortal',kind:'beam',range:450,width:80,speed:Infinity,warning:.35,color:'#dfb59e'},
  yoneQ3:{id:'yoneQ3',champion:'Yone',key:'Q3',name:'Aço Mortal · tornado',kind:'missile',range:950,width:160,speed:1500,warning:.35,color:'#92c9dc'},
  yoneW:{id:'yoneW',champion:'Yone',key:'W',name:'Fenda Espiritual',kind:'cone',range:600,width:80,speed:Infinity,warning:.5,color:'#ec8c83'},
  yoneR:{id:'yoneR',champion:'Yone',key:'R',name:'Destino Selado',kind:'beam',range:1000,width:225,speed:Infinity,warning:.75,color:'#ef646d'},
};

// Opponent decisions are trainer AI. Cast geometry/timing are separate from AI
// so prediction stops at cast start and replay records the actual committed aim.
export class YoneEncounter {
  constructor({target,random=Math.random,bonusAS,pattern='eq',initialStacks=2,difficulty=1,interval=2.5,advanced=false}={}){
    this.advanced=advanced;this.qDecisionAt=0;this.qDecisionStamp=null;this.pressureSide=1;this.nextPressureSideAt=0;this.roundOpener='Q';
    this.target=target;this.position=target.position;this.random=random;
    this.rating=yoneRating(difficulty);this.bonusAS=bonusAS==null?this.rating.bonusAS:Math.max(0,Math.min(120,bonusAS))/100;this.attackSpeed=.625*(1+this.bonusAS);
    this.presetQCooldown=bonusAS==null?this.rating.qCooldown:null;
    this.pattern=pattern;this.initialStacks=Math.max(0,Math.min(2,initialStacks));this.difficulty=difficulty;this.interval=interval;
    this.time=0;this.phase='waiting';this.nextRoundAt=.8;this.action=null;this.serial=0;this.events=[];this.projectiles=[];
    this.spirit=false;this.anchor=null;this.spiritStartedAt=0;this.spiritUntil=0;this.recordedDamage=0;this.playerLockedUntil=0;
    this.qStacks=0;this.stackUntil=0;this.qReadyAt=0;this.attackReadyAt=0;this.wReadyAt=0;this.rReadyAt=0;
    this.rounds=0;this.cleanRounds=0;this.hitsThisRound=0;this.repeatDamage=0;this.facing=0;this.stopped=false;this.shield=0;
    this.playerHistory=[];
    this.stats={Q:{casts:0,hits:0},Q3:{casts:0,hits:0},W:{casts:0,hits:0},R:{casts:0,hits:0},AA:{casts:0,hits:0}};
    target.alive=false;target.respawnAt=Infinity;
  }
  get pending(){return !!this.action||this.projectiles.length>0||this.spirit;}
  get moveSpeed(){const t=this.spirit?Math.min(1,(this.time-this.spiritStartedAt)/5):0,slow=this.target.slowUntil>this.time&&this.target.slowStartsAt<=this.time?this.target.slowAmount:0;return effectiveSpeed(this.rating.moveSpeed*(this.spirit?1.1+.2*t:1)*(1-slow));}
  get qCooldown(){return this.presetQCooldown??yoneQCooldown(this.bonusAS);}
  get qCastTime(){return yoneQCast(this.bonusAS);}
  get active(){return this.target.alive&&this.phase!=='waiting';}
  stop(){this.stopped=true;if(this.spirit&&!this.action)this.beginReturn();}
  startRound(player){
    const angle=this.random()*Math.PI*2,distance=610+this.random()*100;
    this.position.x=player.x+Math.sin(angle)*distance;this.position.z=player.z+Math.cos(angle)*distance;
    this.target.alive=true;this.target.health=this.target.maxHealth;this.target.generation++;this.target.rootUntil=0;this.target.sigils=[];this.target.respawnAt=Infinity;this.shield=0;this.target.shield=0;
    this.target.stunUntil=0;this.target.slowUntil=0;delete this.target.displacement;
    this.rounds++;this.hitsThisRound=0;this.recordedDamage=0;this.qStacks=this.initialStacks;this.stackUntil=this.time+6;
    this.qReadyAt=this.time;this.attackReadyAt=this.time;this.wReadyAt=this.time+.6;this.rReadyAt=this.time+1.8;
    this.qDecisionStamp=null;this.qDecisionAt=this.time;this.pressureSide=this.random()<.5?-1:1;this.nextPressureSideAt=this.time;
    this.roundOpener=this.advanced&&this.pattern==='full'&&this.difficulty>1&&this.random()<.5?'W':'Q';
    this.anchor=copy(this.position);this.spirit=true;this.spiritStartedAt=this.time;this.spiritUntil=this.time+YONE.eDuration;
    this.startAction('e-out',player,300/1200);this.action.end=fullCastEndpoint(this.position,player,300);
    this.phase='e-out';this.events.push({type:'round',number:this.rounds});
  }
  aim(player,velocity,delay){
    // A simulated opponent observes with a small reaction delay. Perfect
    // frame-zero tracking makes short melee Qs artificially unavoidable.
    const lag=({1:.16,2:.1,3:.055})[this.difficulty]??.1;
    const observed=this.playerHistory.findLast(p=>p.time<=this.time-lag)??player;
    const lead=this.random()<({1:.15,2:.45,3:.7}[this.difficulty]??.45);
    const horizon=Math.min(.35,delay);
    return {point:{x:observed.x+(lead?velocity.x*horizon:0),z:observed.z+(lead?velocity.z*horizon:0)},mode:lead?'lead':'current'};
  }
  startAction(kind,point,windup,recovery=0){
    const origin=copy(this.position),end=fullCastEndpoint(origin,point,1),direction={x:end.x-origin.x,z:end.z-origin.z};
    this.facing=Math.atan2(direction.x,direction.z);
    this.action={id:++this.serial,kind,startedAt:this.time,releaseAt:this.time+windup,until:this.time+windup+recovery,duration:windup,origin,direction,released:false};
    this.phase=kind;this.stateUntil=this.action.until;return this.action;
  }
  cast(kind,player,velocity){
    const skill=yoneSkills[`yone${kind}`];
    const windup=kind==='R'?YONE.rCast:kind==='W'?.5*(1-Math.min(.5,.41667*this.bonusAS)):this.qCastTime;
    const aim=this.aim(player,velocity,windup+(kind==='Q3'?dist(this.position,player)/1500:0));
    const action=this.startAction(kind==='Q3'?'q3-windup':kind.toLowerCase(),aim.point,windup,kind==='R'?YONE.rRecovery:kind==='Q3'?.3:.14);
    action.skill={...skill,warning:windup};action.endpoint=fullCastEndpoint(action.origin,aim.point,skill.range);action.aimMode=aim.mode;
    if(kind==='Q'||kind==='Q3'){this.qReadyAt=this.time+this.qCooldown;if(kind==='Q3')this.qStacks=0;}
    if(kind==='W')this.wReadyAt=this.time+14*(1-Math.min(.57143,.6*this.bonusAS));
    if(kind==='R')this.rReadyAt=this.time+80;
    this.stats[kind].casts++;this.events.push({type:'telegraph',action});
  }
  hit(kind,damage,cc=0){
    this.stats[kind].hits++;this.hitsThisRound++;if(this.spirit)this.recordedDamage+=damage;
    if(cc>0)this.playerLockedUntil=Math.max(this.playerLockedUntil,this.time+cc);
    this.events.push({type:'damage',kind,amount:damage,cc});
  }
  resolve(action,hit,damage,cc=0){
    if(action.resolved)return;action.resolved=true;
    if(hit)this.hit(action.skill.key,damage,cc);
    this.events.push({type:'resolve',id:action.id,hit,kind:action.skill.key});
  }
  beginReturn(){
    if(!this.anchor){this.finishRound();return;}
    this.startAction('e-return',this.anchor,Math.max(.12,dist(this.position,this.anchor)/3000));this.action.end=copy(this.anchor);
  }
  finishRound(){
    this.resultPending=true;
    this.spirit=false;this.anchor=null;this.action=null;this.phase='waiting';this.target.alive=false;this.target.respawnAt=Infinity;
    this.target.rootUntil=0;this.target.sigils=[];this.shield=0;this.target.shield=0;this.nextRoundAt=this.time+this.interval;
  }
  update(dt,player,velocity={x:0,z:0},{playerBefore=player,allowStart=true}={}){
    if(dt<=0)return;
    // Training rule: R preparation and recovery do not consume the five-second E.
    // Count only the action's overlap with this tick, including ticks crossing its end.
    if(this.spirit&&this.target.alive&&this.action?.kind==='r'){
      const a=this.action;
      this.spiritUntil+=Math.max(0,Math.min(this.time+dt,a.until)-Math.max(this.time,a.startedAt));
    }
    this.time+=dt;
    this.playerHistory.push({...copy(player),time:this.time});while(this.playerHistory.length>1&&this.playerHistory[0].time<this.time-.5)this.playerHistory.shift();
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i],before=copy(p.position),step=Math.min(1500*dt,950-p.travelled);
      p.position.x+=p.direction.x*step;p.position.z+=p.direction.z*step;p.travelled+=step;
      if(!p.action.resolved&&movingPointDistance(playerBefore,player,before,p.position)<=145)this.resolve(p.action,true,90,.75);
      if(p.travelled>=950){this.resolve(p.action,false,0);this.projectiles.splice(i,1);}
    }
    if(this.qStacks&&this.time>=this.stackUntil)this.qStacks=0;
    if(this.target.shieldUntil<=this.time)this.target.shield=0;
    if(this.phase==='waiting'){
      if(this.resultPending&&!this.projectiles.length){if(!this.hitsThisRound)this.cleanRounds++;this.resultPending=false;}
      if(allowStart&&!this.stopped&&this.time>=this.nextRoundAt)this.startRound(player);return;
    }
    if(!this.target.alive){
      if(this.action?.kind==='r'&&this.action.released&&!this.action.resolved){if(this.time<this.action.damageAt)return;this.resolve(this.action,this.action.rHit,140,YONE.rKnockup);}
      if(this.action?.skill&&!this.action.released)this.resolve(this.action,false,0);
      this.finishRound();return;
    }
    // Forced movement is supplied by the player's combat simulation. Stun
    // interrupts uncommitted attacks; already released R and E return finish.
    if(this.target.stunUntil>this.time&&this.action?.kind!=='e-return'&&!(this.action?.kind==='r'&&this.action.released)){
      if(this.action?.skill&&!this.action.resolved)this.resolve(this.action,false,0);
      this.action=null;this.phase='stunned';return;
    }
    if(this.action){
      const a=this.action;
      if(a.kind==='e-out'||a.kind==='e-return'){
        const t=Math.min(1,(this.time-a.startedAt)/a.duration);this.position.x=a.origin.x+(a.end.x-a.origin.x)*t;this.position.z=a.origin.z+(a.end.z-a.origin.z)*t;
        if(t>=1){if(a.kind==='e-return'){
          const damage=Math.round(this.recordedDamage*.3);this.repeatDamage+=damage;if(damage)this.events.push({type:'damage',kind:'E',amount:damage,cc:0});this.finishRound();return;
        }this.action=null;this.phase='idle';}return;
      }
      if(a.kind==='q3-dash'){
        const t=Math.min(1,(this.time-a.releaseAt)/.3),before=copy(this.position);
        this.position.x=a.origin.x+a.direction.x*450*t;this.position.z=a.origin.z+a.direction.z*450*t;
        if(!a.resolved&&movingPointDistance(playerBefore,player,before,this.position)<=YONE.q3BodyRadius+65)this.resolve(a,true,90,.75);
        if(t>=1){this.action=null;this.phase='idle';}return;
      }
      if(!a.released&&this.time+1e-8>=a.releaseAt){
        a.released=true;
        if(a.kind==='attack'){
          // A committed swing has a small target escape tolerance; range exits
          // never restart its animation or refund the attack interval.
          if(dist(this.position,player)<=175+65+65+50)this.hit('AA',55);
        }else if(a.kind==='q'){
          const hit=pointSegmentDistanceXZ(player,a.origin,a.endpoint)<=105;
          this.resolve(a,hit,90);if(hit){this.qStacks=Math.min(2,this.qStacks+1);this.stackUntil=this.time+6;}
        }else if(a.kind==='q3-windup'){
          a.kind='q3-dash';this.phase='q3-dash';this.projectiles.push({id:a.id,action:a,position:copy(a.origin),direction:a.direction,travelled:0});return;
        }else if(a.kind==='w'){
          const dx=player.x-a.origin.x,dz=player.z-a.origin.z,d=Math.hypot(dx,dz),dot=(dx*a.direction.x+dz*a.direction.z)/(d||1);
          const hit=d<=665&&Math.acos(Math.max(-1,Math.min(1,dot)))<=40*Math.PI/180+Math.asin(Math.min(1,65/(d||1)));
          this.resolve(a,hit,70);this.target.shield=hit?120:60;this.target.shieldUntil=this.time+1.5;
        }else if(a.kind==='r'){
          const hit=pointSegmentDistanceXZ(player,a.origin,a.endpoint)<=177.5;a.rHit=hit;a.damageAt=a.releaseAt+YONE.rImpactDelay;this.phase='r-impact';
          if(hit){this.playerLockedUntil=Math.max(this.playerLockedUntil,a.damageAt+YONE.rKnockup);this.events.push({type:'control',kind:'R'});}
          const landing=hit?{x:player.x+a.direction.x*YONE.rBlinkBehind,z:player.z+a.direction.z*YONE.rBlinkBehind}:a.endpoint;Object.assign(this.position,landing);
        }
      }
      if(a.kind==='r'&&a.released&&!a.resolved&&this.time+1e-8>=a.damageAt)this.resolve(a,a.rHit,140,YONE.rKnockup);
      if(this.time>=a.until){this.action=null;this.phase='idle';}return;
    }
    if(this.spirit&&(this.time>=this.spiritUntil||this.stopped||!allowStart)){
      if(this.target.rootUntil>this.time){this.phase='idle';return;}this.beginReturn();return;
    }
    if(!allowStart||this.stopped)return;
    const d=dist(this.position,player),rooted=this.target.rootUntil>this.time;
    if(this.advanced&&this.qStacks>=2&&this.qDecisionStamp!==this.qReadyAt&&d<=780){this.qDecisionStamp=this.qReadyAt;this.qDecisionAt=Math.max(this.time,this.qReadyAt)+({1:0,2:.12,3:.32})[this.difficulty]*this.random();}
    if(this.roundOpener==='W'&&this.time>=this.wReadyAt&&d<560){this.roundOpener='Q';this.cast('W',player,velocity);return;}
    if((this.roundOpener!=='W'||d>=560||this.time>this.spiritStartedAt+1.3)&&this.time>=this.qReadyAt&&(!this.advanced||this.qStacks<2||this.time>=this.qDecisionAt)&&d<=(this.qStacks>=2?780:475)&&!(rooted&&this.qStacks>=2)){this.cast(this.qStacks>=2?'Q3':'Q',player,velocity);return;}
    if(this.pattern==='full'&&this.time>=this.rReadyAt&&this.time>=this.playerLockedUntil+.2&&d<900&&!rooted){this.cast('R',player,velocity);return;}
    if(this.pattern==='full'&&this.time>=this.wReadyAt&&d<560){this.cast('W',player,velocity);return;}
    if(d<=305&&this.time>=this.attackReadyAt){
      this.startAction('attack',player,.3/this.attackSpeed,.12);this.attackReadyAt=this.time+1/this.attackSpeed;this.stats.AA.casts++;return;
    }
    if(!rooted&&d>270){
      let destination=player;
      if(this.advanced){if(this.time>=this.nextPressureSideAt){this.pressureSide=this.random()<.5?-1:1;this.nextPressureSideAt=this.time+.45+this.random()*.5;}const dx=player.x-this.position.x,dz=player.z-this.position.z;destination={x:player.x-dz/(d||1)*90*this.pressureSide,z:player.z+dx/(d||1)*90*this.pressureSide};}
      this.facing=Math.atan2(destination.x-this.position.x,destination.z-this.position.z);advance(this.position,destination,Math.min(this.moveSpeed,(d-270)/dt),dt);this.phase='run';
    }else this.phase='idle';
  }
  drainEvents(){return this.events.splice(0);}
  replay(shot){
    this.stopped=true;this.spirit=false;this.anchor=null;this.projectiles=[];this.events=[];
    this.target.alive=true;Object.assign(this.position,shot.origin);
    const kind=yoneSkills[shot.skill].key,a=this.startAction(kind==='Q3'?'q3-windup':kind.toLowerCase(),shot.endpoint,shot.warning,kind==='R'?YONE.rRecovery:kind==='Q3'?.3:.14);
    a.skill={...yoneSkills[shot.skill],warning:shot.warning};a.endpoint=copy(shot.endpoint);a.aimMode=shot.aimMode;this.events.push({type:'telegraph',action:a});
  }
  summary(){return {rounds:this.rounds,cleanRounds:this.cleanRounds,repeatDamage:this.repeatDamage,stats:JSON.parse(JSON.stringify(this.stats))};}
}
