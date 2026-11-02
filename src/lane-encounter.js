import {pointSegmentDistanceXZ} from './dodge-simulation.js';
const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const move=(p,to,speed,dt)=>{const d=dist(p,to),k=Math.min(1,speed*dt/(d||1));p.x+=(to.x-p.x)*k;p.z+=(to.z-p.z)*k;return d>1;};
// Training wave stats, not a claim to simulate all Summoner's Rift minion rules.
export const LANE_MINIONS={melee:{health:360,damage:12,period:1.25,range:85,windup:.3},caster:{health:240,damage:17,period:1.55,range:410,windup:.35},siege:{health:650,damage:27,period:1.8,range:450,windup:.4}};
const formation=[['melee',-115,-240],['melee',0,-260],['melee',115,-240],['siege',0,-80],['caster',-145,45],['caster',0,65],['caster',145,45]];
export function laneTargets(){return [{id:'lane-enemy',position:{x:130,z:-880},maxHealth:3000,radius:65,kind:'champion'},...formation.map(([kind,x,z],i)=>({id:`lane-red-${i}`,kind,team:'red',position:{x,z:-650-z},maxHealth:LANE_MINIONS[kind].health,radius:kind==='siege'?38:27}))];}

export class LaneEncounter {
  constructor({combat,random=Math.random,difficulty=2,coach=true,advanced=false}={}){
    this.advanced=advanced;this.trades=0;this.tradeHits=0;this.tradeDamage=0;this.combat=combat;this.target=combat.target('lane-enemy');this.position=this.target.position;this.random=random;this.coach=coach;
    this.profile=({1:{reaction:.26,speed:340},2:{reaction:.15,speed:370},3:{reaction:.08,speed:400}})[difficulty]??{reaction:.15,speed:370};
    if(advanced)this.profile={...this.profile,speed:340};
    this.time=0;this.phase='idle';this.action=null;this.facing=Math.PI;this.serial=0;this.attackReadyAt=0;this.attackPeriod=1/.75;this.windup=.285;this.attackDamage=62;this.attackRange=525;this.missileSpeed=1700;
    this.minions=[];this.projectiles=[];this.threats=[];this.attempts=[];this.windows=[];this.wave=0;this.nextWaveAt=Infinity;this.stopped=false;this.goal=copy(this.position);this.nextDecision=0;this.respawnAt=Infinity;
    this.lastHits=0;this.missed=0;this.contested=0;this.punished=0;this.enemyDamage=0;this.feedback='Observe a vida dos minions. Conjure quando o ataque começar.';
    this.farmLastHits=0;this.farmMissed=0;this.siegeSecured=0;this.farmClaims=new Set();this.punishUntil=0;this.counterTrades=0;
    for(const [i,[kind,x,z]] of formation.entries()){
      this.minions.push({id:`lane-blue-${i}`,kind,team:'blue',position:{x,z},radius:kind==='siege'?38:27,maxHealth:LANE_MINIONS[kind].health,health:0,alive:false,generation:0});
      this.minions.push(combat.target(`lane-red-${i}`));
    }
    this.spawnWave();
  }
  get moveSpeed(){const slow=this.target.slowUntil>this.combat.time&&this.target.slowStartsAt<=this.combat.time?this.target.slowAmount:0;return this.profile.speed*(1-slow);}
  get pending(){return !!this.action||this.projectiles.length>0||(this.stopped&&this.attempts.some(a=>!a.hit&&a.until>this.time));}
  spawnWave(){
    this.cancelAttack();this.wave++;this.projectiles=[];this.nextWaveAt=Infinity;this.phase='idle';
    for(const m of this.minions){const i=Number(m.id.split('-').at(-1)),[,x,z]=formation[i];Object.assign(m.position,{x,z:m.team==='blue'?z:-650-z});Object.assign(m,{alive:true,health:m.maxHealth,generation:m.generation+1,respawnAt:Infinity,readyAt:this.time+.4+this.random()*.8,moveSpeed:this.advanced?350:160,action:null,deathCounted:false,stunUntil:0,rootUntil:0,slowUntil:0});delete m.displacement;}
  }
  stop(){this.stopped=true;for(const m of this.minions)m.action=null;}
  cancelAttack(){if(this.action){const window=this.windows.find(w=>w.id===this.action.id);if(window)window.release=Math.min(window.release,this.time);}this.action=null;}
  minion(id){return this.minions.find(m=>m.id===id);}
  damageMinion(m,amount,source){if(!m?.alive)return;m.health=Math.max(0,m.health-amount);if(!m.health){m.alive=false;m.respawnAt=Infinity;m.action=null;if(m.team==='blue'){if(source==='enemy')this.lastHits++;else this.missed++;m.deathCounted=true;}else if(source!=='player')this.farmMissed++;}}
  launch(from,target,damage,source,speed=900){this.projectiles.push({id:++this.serial,position:copy(from),origin:copy(from),targetId:target.id,generation:target.generation,damage,source,speed});}
  incomingHealth(m,arrival){return m.health-this.projectiles.filter(p=>p.targetId===m.id&&p.generation===m.generation&&dist(p.position,m.position)/p.speed<=arrival).reduce((sum,p)=>sum+p.damage,0);}
  observe(events){
    for(const event of events){
      if(event.type==='kill'&&event.targetId?.startsWith('lane-red-')){const m=this.minion(event.targetId),key=m&&`${m.id}:${m.generation}`;if(m&&!this.farmClaims.has(key)){this.farmClaims.add(key);this.farmLastHits++;if(m.kind==='siege')this.siegeSecured++;}}
      if(event.type==='spell'&&!event.returning&&event.phase!=='pickup'){
        const window=this.windows.findLast(w=>this.combat.time>=w.start&&this.combat.time<=w.release);
        const relevant=event.targetId===this.target.id||dist(event.point,this.position)<420||event.ability==='E';
        if(this.advanced&&relevant&&!window)this.punishUntil=this.combat.time+1.6;
        if(relevant)this.attempts.push({id:event.id,key:event.key,at:this.combat.time,windowId:window?.id,hit:false,until:this.combat.time+3});
        const circle=event.ability==='Q'&&this.combat.champion==='syndra'||event.ability==='W';
        if(circle||event.ability==='E')this.threats.push({id:event.id,kind:circle?'circle':'line',point:copy(event.end??event.point),origin:copy(event.origin),radius:circle?(event.ability==='Q'?180:220):100,noticedAt:this.combat.time+this.profile.reaction,until:this.combat.time+(circle?(event.ability==='Q'?.6:event.duration??.4):.85)});
      }
      if(event.type==='hit'&&event.targetId===this.target.id){
        this.enemyDamage+=event.amount;
        if(event.spellId==null)continue;
        const attempt=this.attempts.find(a=>a.id===event.spellId);
        if(attempt&&!attempt.hit){attempt.hit=true;if(attempt.windowId!=null){this.punished++;this.feedback='Boa janela: poke lançado durante o autoattack de farm.';}else this.feedback='Poke acertou, mas foi lançado fora da preparação do last hit.';}
      }
    }
  }
  danger(point){let score=0;for(const t of this.threats){if(this.time<t.noticedAt)continue;const d=t.kind==='circle'?dist(point,t.point):pointSegmentDistanceXZ(point,t.origin,t.point);score+=Math.max(0,t.radius+65+18-d);}return score;}
  chooseDodge(){
    if(!this.threats.some(t=>this.time>=t.noticedAt))return null;
    let best=null,bestScore=Infinity;const horizon=.5;
    for(let i=0;i<24;i++){const a=i*Math.PI/12,p={x:this.position.x+Math.cos(a)*this.moveSpeed*horizon,z:this.position.z+Math.sin(a)*this.moveSpeed*horizon};
      const clearance=Math.min(...this.threats.filter(t=>this.time>=t.noticedAt).map(t=>t.kind==='circle'?dist(p,t.point):pointSegmentDistanceXZ(p,t.origin,t.point)));
      const score=this.danger(p)*15-Math.min(400,clearance)*.3+Math.max(0,550-dist(p,this.player))*2+Math.max(0,Math.abs(p.x)-750)+Math.max(0,-1200-p.z);
      if(score<bestScore){bestScore=score;best=p;}
    }
    return this.danger(this.position)>0?best:null;
  }
  beginTrade(){
    if(this.time<this.punishUntil)this.counterTrades++;
    this.action={id:++this.serial,targetId:"player",startedAt:this.time,releaseAt:this.time+this.windup,until:this.time+this.windup,released:false};
    this.phase="attack";this.facing=Math.atan2(this.player.x-this.position.x,this.player.z-this.position.z);this.attackReadyAt=this.time+this.attackPeriod;this.trades++;
  }
  beginAttack(minion){
    const id=++this.serial;this.action={id,targetId:minion.id,generation:minion.generation,startedAt:this.time,releaseAt:this.time+this.windup,until:this.time+this.windup,released:false};
    this.phase='attack';this.facing=Math.atan2(minion.position.x-this.position.x,minion.position.z-this.position.z);this.attackReadyAt=this.time+this.attackPeriod;
    this.windows.push({id,start:this.time,release:this.action.releaseAt});this.contested++;
  }
  update(dt,player){
    if(dt<=0)return;this.player=copy(player);let left=dt;while(left>1e-9){const step=Math.min(left,1/120);this.step(step);left-=step;}
  }
  step(dt){
    this.time+=dt;this.threats=this.threats.filter(t=>t.until>=this.time);
    for(const p of this.projectiles){if(p.targetId==="player"){const d=dist(p.position,this.player);move(p.position,this.player,p.speed,dt);if(d<=p.speed*dt){const damage=Math.min(this.combat.playerHealth,p.damage);this.combat.takeDamage(p.damage);this.tradeDamage+=damage;this.tradeHits++;this.feedback="Você entrou no alcance do autoattack. Reposicione depois do poke.";p.done=true;}continue;}const m=this.minion(p.targetId);if(!m?.alive||m.generation!==p.generation){p.done=true;continue;}const d=dist(p.position,m.position);move(p.position,m.position,p.speed,dt);if(d<=p.speed*dt){this.damageMinion(m,p.damage,p.source);p.done=true;}}
    this.projectiles=this.projectiles.filter(p=>!p.done);
    for(const m of this.minions){
      if(!m.alive){m.respawnAt=Infinity;continue;}if(this.stopped)continue;
      const stats=LANE_MINIONS[m.kind];if(m.stunUntil>this.combat.time){m.action=null;continue;}
      if(m.action){const a=m.action;if(this.time>=a.releaseAt){const target=this.minion(a.targetId);if(target?.alive&&target.generation===a.generation){if(m.kind==='melee')this.damageMinion(target,stats.damage,'minion');else this.launch(m.position,target,stats.damage,'minion');}m.action=null;}continue;}
      const target=this.minions.filter(other=>other.team!==m.team&&other.alive).sort((a,b)=>dist(m.position,a.position)-dist(m.position,b.position))[0];if(!target)continue;
      if(dist(m.position,target.position)>stats.range+m.radius+target.radius){if(!(m.rootUntil>this.combat.time))move(m.position,target.position,m.moveSpeed,dt);}
      else if(this.time>=m.readyAt){m.action={targetId:target.id,generation:target.generation,startedAt:this.time,releaseAt:this.time+stats.windup};m.readyAt=this.time+stats.period;}
    }
    if(!this.stopped&&this.minions.filter(m=>m.team==='red'&&!m.alive).length>=3)this.spawnWave();
    else if(!this.stopped&&!this.minions.some(m=>m.team==='blue'&&m.alive)){if(!Number.isFinite(this.nextWaveAt))this.nextWaveAt=this.time+3;if(this.time>=this.nextWaveAt)this.spawnWave();}
    if(!this.target.alive){this.target.respawnAt=Infinity;this.cancelAttack();this.phase='waiting';if(!Number.isFinite(this.respawnAt))this.respawnAt=this.time+3;if(!this.stopped&&this.time>=this.respawnAt){Object.assign(this.target,{alive:true,health:this.target.maxHealth,generation:this.target.generation+1,stunUntil:0,rootUntil:0,slowUntil:0,sigils:[]});delete this.target.displacement;Object.assign(this.position,{x:130,z:-880});this.respawnAt=Infinity;}return;}
    if(this.target.stunUntil>this.combat.time){this.cancelAttack();this.phase='stunned';return;}
    if(this.action){
      const a=this.action;if(this.time>=a.releaseAt){if(a.targetId==="player"){if(dist(this.position,this.player)<=this.attackRange+130)this.launch(this.position,{id:"player",generation:0},this.attackDamage,"enemy",this.missileSpeed);a.released=true;this.action=null;this.phase="idle";return;}const m=this.minion(a.targetId);if(m?.alive&&m.generation===a.generation)this.launch(this.position,m,this.attackDamage,'enemy',this.missileSpeed);a.released=true;this.action=null;this.phase='idle';}return;
    }
    if(this.stopped){this.phase='idle';return;}
    const rooted=this.target.rootUntil>this.combat.time,dodge=this.chooseDodge();
    const blue=this.minions.filter(m=>m.team==='blue'&&m.alive),lastHits=blue.filter(m=>m.health<=this.attackDamage&&this.incomingHealth(m,this.windup+dist(this.position,m.position)/this.missileSpeed)>0).sort((a,b)=>a.health-b.health);
    const candidate=lastHits.find(m=>dist(this.position,m.position)<=this.attackRange+65+m.radius);
    // Commit to farming: visual threats do not magically cancel the windup.
    if(candidate&&this.time>=this.attackReadyAt){this.beginAttack(candidate);return;}
    if(this.advanced&&!dodge&&this.time>=this.attackReadyAt&&this.combat.playerHealth>0&&dist(this.position,this.player)<=this.attackRange+130&&(this.time<this.punishUntil||!blue.some(m=>m.health<this.attackDamage*1.8))){this.beginTrade();return;}
    if(rooted){this.phase='idle';return;}
    if(dodge)this.goal=dodge;
    else if(this.time>=this.nextDecision){
      this.nextDecision=this.time+.3+this.random()*.35;
      const soon=[...blue].sort((a,b)=>a.health-b.health)[0];
      if(soon&&soon.health<this.attackDamage*2.7){const d=dist(this.position,soon.position)||1,reach=this.attackRange+65+soon.radius-25;this.goal={x:soon.position.x+(this.position.x-soon.position.x)/d*reach,z:soon.position.z+(this.position.z-soon.position.z)/d*reach};}
      else{const side=this.random()<.5?-1:1;this.goal={x:Math.max(-600,Math.min(600,this.position.x+side*(120+this.random()*170))),z:-780-this.random()*100};}
      // Keep a sensible gap when the player walks up, without leaving lane.
      if(dist(this.goal,this.player)<610){const d=dist(this.goal,this.player)||1;this.goal.x=this.player.x+(this.goal.x-this.player.x)/d*610;this.goal.z=this.player.z+(this.goal.z-this.player.z)/d*610;}
    }
    this.goal.x=Math.max(-900,Math.min(900,this.goal.x));this.goal.z=Math.max(-1250,Math.min(-200,this.goal.z));
    const before=copy(this.position),moving=move(this.position,this.goal,this.moveSpeed,dt);this.phase=moving?'run':'idle';if(moving)this.facing=Math.atan2(this.position.x-before.x,this.position.z-before.z);
  }
  summary(){const done=this.attempts.filter(a=>a.hit||a.until<=this.time),timed=done.filter(a=>a.windowId!=null),hits=done.filter(a=>a.hit);return {farmLastHits:this.farmLastHits,farmMissed:this.farmMissed,siegeSecured:this.siegeSecured,counterTrades:this.counterTrades,farmAccuracy:this.farmLastHits+this.farmMissed?Math.round(100*this.farmLastHits/(this.farmLastHits+this.farmMissed)):null,waves:this.wave,lastHits:this.lastHits,missed:this.missed,windows:this.contested,punished:new Set(done.filter(a=>a.hit&&a.windowId!=null).map(a=>a.windowId)).size,trades:this.trades,tradeHits:this.tradeHits,tradeDamage:this.tradeDamage,casts:done.length,hits:hits.length,timedCasts:timed.length,timedHits:timed.filter(a=>a.hit).length,offWindowHits:done.filter(a=>a.windowId==null&&a.hit).length,enemyDamage:this.enemyDamage,accuracy:done.length?Math.round(hits.length/done.length*100):null};}
}
