import {MovementObserver} from './training-rules.js';
import {advance,effectiveSpeed} from './simulation.js';
import {fullCastEndpoint,movingPointDistance} from './dodge-simulation.js';
import {matchupSkills,matchupProfiles} from './matchup-data.js';
const copy=p=>({x:p.x,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// Repeating dodge drills, not a full champion AI. Original projectile values are
// separate from deliberate practice choices: spawn points, aim policy and cadence.
export class MatchupEncounter {
  constructor({champion='ahri',difficulty=2,random=Math.random,interval=1,pattern='mixed',advanced=false}={}){
    this.advanced=advanced;this.observer=new MovementObserver();this.nextSideAt=0;this.champion=champion;this.profile=matchupProfiles[champion];this.difficulty=difficulty;this.random=random;this.interval=interval;this.pattern=pattern;
    this.time=0;this.position={x:0,z:0};this.facing=0;this.phase='waiting';this.nextRoundAt=.3;this.serial=0;this.rounds=0;
    this.action=null;this.projectiles=[];this.events=[];this.queue=[];this.nextCastAt=0;this.stopped=false;
    this.slowUntil=0;this.slowAmount=0;this.charmUntil=0;this.nails=0;this.nailsUntil=0;this.side=1;
    this.completedRounds=0;this.cleanRounds=0;this.roundHits=0;this.results={};this.roundCounted=false;this.thirdHold=0;
  }
  get pending(){return !!this.action||this.projectiles.length>0||this.charmed||this.time<this.slowUntil;}
  get active(){return this.phase!=='waiting';}
  get charmed(){return this.time<this.charmUntil;}
  get playerSpeedMultiplier(){return this.charmed?.35:this.time<this.slowUntil?1-this.slowAmount:1;}
  startRound(player){
    const angle=this.random()*Math.PI*2,range=740+this.random()*100;
    this.position={x:player.x+Math.sin(angle)*range,z:player.z+Math.cos(angle)*range};
    this.facing=Math.atan2(player.x-this.position.x,player.z-this.position.z);this.phase='run';this.rounds++;this.side=this.random()<.5?-1:1;
    this.queue=this.champion==='locke'?['lockeQ1','lockeQ2','lockeQ3']:this.pattern==='q'?['ahriQ']:this.pattern==='e'?['ahriE']:(this.advanced?this.random()<.5:this.rounds%2)?['ahriE','ahriQ']:['ahriQ','ahriE'];
    this.roundHits=0;this.roundCounted=false;this.roundCasts=0;this.roundExpected=this.queue.length;this.thirdHold=this.advanced&&this.champion==='locke'&&this.difficulty>1?this.random()*({2:.25,3:.65})[this.difficulty]:0;
    this.nextCastAt=this.time+(this.advanced?.25+this.random()*.5:.45);this.roundStarted=this.time;this.nails=0;this.nailsUntil=0;
    this.events.push({type:'round',number:this.rounds});
  }
  cast(id,player,velocity={x:0,z:0},replay=null){
    if(!replay)this.roundCasts=(this.roundCasts??0)+1;
    const skill=matchupSkills[id],origin=copy(this.position);
    const lead=!replay&&this.random()<({1:.15,2:.45,3:.7})[this.difficulty];
    const horizon=Math.min(.55,skill.warning+distance(origin,player)/skill.speed);
    const observed=this.advanced?this.observer.aim(this.time,origin,skill,{reaction:({1:.2,2:.14,3:.1})[this.difficulty],lead,strength:.85+this.random()*.15}):null;
    const point=replay?.endpoint??observed??{x:player.x+(lead?velocity.x*horizon:0),z:player.z+(lead?velocity.z*horizon:0)};
    const endpoint=fullCastEndpoint(origin,point,skill.range),direction={x:(endpoint.x-origin.x)/skill.range,z:(endpoint.z-origin.z)/skill.range};
    const warning=replay?.warning??skill.warning;
    const action={id:++this.serial,skill:{...skill,warning},origin,endpoint,direction,aimMode:replay?.aimMode??(lead?'lead':'current'),startedAt:this.time,releaseAt:this.time+warning,until:this.time+warning+.13,released:false};
    this.action=action;this.facing=Math.atan2(direction.x,direction.z);this.phase='cast';
    this.nextCastAt=this.time+(this.champion==='locke'?({1:1.05,2:.78,3:.55})[this.difficulty]:.85)*(this.advanced?.85+this.random()*.55:1);
    if(this.advanced&&this.champion==='ahri')this.nextCastAt=this.time+({1:.95,2:.78,3:.6})[this.difficulty]+this.random()*.18;
    if(id==='lockeQ2')this.nextCastAt+=this.thirdHold;
    this.events.push({type:'telegraph',action});return action;
  }
  launch(a){
    a.released=true;
    this.projectiles.push({id:a.id,action:a,skill:a.skill,position:copy(a.origin),direction:copy(a.direction),travelled:0,speed:a.skill.speed,age:0,returning:a.skill.id==='ahriQReturn'});
  }
  resolve(a,hit){if(a.resolved)return;a.resolved=true;const stats=this.results[a.skill.id]??={total:0,hits:0};stats.total++;if(hit){stats.hits++;this.roundHits++;}this.events.push({type:'resolve',action:a,hit});}
  applyHit(p){
    this.resolve(p.action,true);
    if(p.skill.id==='ahriE'){this.charmUntil=this.time+1.2;this.events.push({type:'charm'});}
    if(p.skill.id.startsWith('locke')){
      this.nails=this.time<this.nailsUntil?Math.min(3,this.nails+1):1;this.nailsUntil=this.time+4;
      this.slowAmount=this.nails===3?.6:.25;this.slowUntil=this.time+(this.nails===3?2:1);
    }
  }
  updateProjectiles(dt,player,playerBefore){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i],before=copy(p.position);p.age+=dt;
      const oldSpeed=p.speed;
      if(p.skill.id==='ahriQ')p.speed=Math.max(400,p.speed-3200*dt);
      if(p.returning)p.speed=Math.min(2600,p.speed+1900*dt);
      let remaining=p.skill.range-p.travelled;
      if(p.returning){remaining=distance(p.position,this.position);if(remaining>1e-8)p.direction={x:(this.position.x-p.position.x)/remaining,z:(this.position.z-p.position.z)/remaining};}
      const step=Math.min(remaining,(oldSpeed+p.speed)*.5*dt);
      p.position.x+=p.direction.x*step;p.position.z+=p.direction.z*step;p.travelled+=step;
      const clearance=movingPointDistance(playerBefore,player,before,p.position)-(p.skill.width/2+65);
      this.events.push({type:'clearance',action:p.action,value:clearance});
      if(!p.action.resolved&&clearance<=0)this.applyHit(p);
      const end=step>=remaining-1e-7||p.age>6||(p.skill.id==='ahriE'&&p.action.resolved);
      if(!end)continue;
      this.resolve(p.action,false);
      if(p.skill.id==='ahriQ'){
        const origin=copy(p.position),endpoint=copy(this.position),length=distance(origin,endpoint)||1;
        const skill={...matchupSkills.ahriQReturn,range:length};
        const a={id:++this.serial,skill,origin,endpoint,direction:{x:(endpoint.x-origin.x)/length,z:(endpoint.z-origin.z)/length},aimMode:'return',startedAt:this.time,releaseAt:this.time,until:this.time,released:true};
        this.events.push({type:'telegraph',action:a});this.launch(a);
      }
      this.projectiles.splice(i,1);
    }
  }
  update(dt,player,velocity={x:0,z:0},{playerBefore=player,allowStart=true}={}){
    if(dt<=0)return;this.time+=dt;this.observer.record(this.time,player);
    if(this.time>=this.nailsUntil)this.nails=0;
    this.updateProjectiles(dt,player,playerBefore);
    if(this.action){const a=this.action;if(!a.released&&this.time+1e-8>=a.releaseAt)this.launch(a);if(this.time+1e-8>=a.until){this.action=null;this.phase='idle';}return;}
    if(this.phase==='waiting'){if(allowStart&&!this.stopped&&this.time>=this.nextRoundAt)this.startRound(player);return;}
    if(!allowStart||this.stopped)this.queue=[];
    if(!this.queue.length&&!this.pending){if(!this.roundCounted&&this.roundExpected>0&&this.roundCasts>=this.roundExpected){this.roundCounted=true;this.completedRounds++;if(!this.roundHits)this.cleanRounds++;}this.phase='waiting';this.nextRoundAt=this.time+this.interval*(this.advanced?({1:1,2:.8,3:.6})[this.difficulty]:1);return;}
    if(this.stopped||!allowStart){this.phase='idle';return;}
    if(this.queue.length&&this.time>=this.nextCastAt&&distance(this.position,player)<860){this.cast(this.queue.shift(),player,velocity);return;}
    // Reposition between casts. Ahri's returning Q follows her current position.
    const dx=player.x-this.position.x,dz=player.z-this.position.z,d=Math.hypot(dx,dz)||1;
    if(this.advanced&&this.time>=this.nextSideAt){this.side=this.random()<.5?-1:1;this.nextSideAt=this.time+.45+this.random()*.75;}
    let destination=d>660?player:{x:this.position.x-dz/d*130*this.side,z:this.position.z+dx/d*130*this.side};
    // Shift Ahri toward the continuation of orb → player, creating a new return angle.
    const orb=this.advanced&&this.projectiles.find(p=>p.skill.id==='ahriQ'||p.returning);
    if(orb){const seen=this.observer.aim(this.time,this.position,{speed:Infinity,warning:0},{reaction:({1:.2,2:.14,3:.1})[this.difficulty],lead:false})??player;const ox=seen.x-orb.position.x,oz=seen.z-orb.position.z,od=Math.hypot(ox,oz)||1;destination={x:seen.x+ox/od*480,z:seen.z+oz/od*480};}
    const before=copy(this.position);advance(this.position,destination,this.profile.speed,dt);
    this.facing=Math.atan2(this.position.x-before.x,this.position.z-before.z);this.phase='run';
  }
  moveCharmedPlayer(player,speed,dt){if(!this.charmed)return false;return advance(player,this.position,effectiveSpeed(speed*.35),dt);}
  stop(){this.stopped=true;this.queue=[];}
  summary(){return {champion:this.champion,completedRounds:this.completedRounds,cleanRounds:this.cleanRounds,results:JSON.parse(JSON.stringify(this.results))};}
  drainEvents(){return this.events.splice(0);}
  replay(shot){
    this.stopped=true;this.queue=[];this.phase='idle';this.position=copy(shot.origin);
    if(shot.skill==='ahriQReturn')this.position=copy(shot.endpoint);
    const a=this.cast(shot.skill,shot.start,{x:0,z:0},shot);a.origin=copy(shot.origin);a.endpoint=copy(shot.endpoint);a.direction=copy(shot.direction);
    if(shot.skill==='ahriQReturn'){this.launch(a);this.action=null;this.phase='idle';}
  }
}
