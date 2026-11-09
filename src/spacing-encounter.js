import {advance,effectiveSpeed} from './simulation.js';
import {PLAYER_RADIUS} from './combat.js';

const copy=p=>({x:p.x,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),percent=(a,b)=>b?Math.round(100*a/b):null;
// Installed Lucian CharacterRecord and basic-attack missile; see spacing-mode.md.
export const SPACING_LUCIAN={range:500,radius:65,moveSpeed:335,baseAS:.638,asGrowth:.025,windupFraction:.15,missileSpeed:2800,damage:60,damageGrowth:2.9};
export const SPACING_POLICIES={1:{reaction:.32,decision:.34,retreat:90,feint:.05},2:{reaction:.20,decision:.20,retreat:140,feint:.25},3:{reaction:.11,decision:.11,retreat:190,feint:.5}};
export function spacingTargets(){return [{id:'spacing-lucian',kind:'champion',position:{x:0,z:-720},radius:65,maxHealth:2800}];}

export class SpacingEncounter {
  constructor({combat,random=Math.random,difficulty=2}={}){
    this.combat=combat;this.target=combat.target('spacing-lucian');this.position=this.target.position;this.random=random;
    this.policy=SPACING_POLICIES[clamp(Math.round(difficulty)||2,1,3)];this.difficulty=difficulty;this.time=combat.time;
    const level=clamp(combat.level??6,1,18),growth=.7025*(level-1)+.0175*(level*level-1);
    this.attackSpeed=SPACING_LUCIAN.baseAS*(1+SPACING_LUCIAN.asGrowth*growth);this.windup=SPACING_LUCIAN.windupFraction/this.attackSpeed;
    this.attackDamage=Math.round(SPACING_LUCIAN.damage+SPACING_LUCIAN.damageGrowth*growth);
    this.player={x:0,z:0};this.previousPlayer=copy(this.player);this.observedPlayer=copy(this.player);this.samples=[];
    this.goal=copy(this.position);this.phase='idle';this.facing=Math.PI;this.moving=false;this.nextDecision=this.time+.3;this.readyAt=this.time+.8;this.inRangeSince=null;
    this.attack=null;this.serial=0;this.projectiles=[];this.viewEvents=[];this.stopped=false;this.respawnAt=Infinity;this.side=random()<.5?-1:1;
    this.playerReleases=0;this.playerHits=0;this.cleanHits=0;this.trades=0;this.retaliationHits=0;this.enemyReleases=0;this.deniedAttacks=0;this.cancelled=0;
    this.bandTime=0;this.activeTime=0;this.cleanStreak=0;this.bestStreak=0;this.kills=0;this.respawns=0;this.records=new Map();this.retaliationTimes=[];
    this.feedback='Ataque na faixa de 500–650 u e recue depois do disparo. Um tiro inimigo já lançado acompanha você.';
    this.target.respawnAt=Infinity;this.target.previousPosition=copy(this.position);
  }
  get active(){return this.target.alive;}
  get enemyRange(){return SPACING_LUCIAN.range;}
  get playerRange(){return this.combat.range;}
  get edgeDistance(){return Math.max(0,distance(this.position,this.player)-PLAYER_RADIUS-this.target.radius);}
  get moveSpeed(){const slow=this.target.slowUntil>this.time&&(this.target.slowStartsAt??0)<=this.time?this.target.slowAmount??0:0;return effectiveSpeed(SPACING_LUCIAN.moveSpeed*(1-slow));}
  get pending(){return this.projectiles.length>0||[...this.records.values()].some(r=>r.hit&&!r.settled);}
  get controlled(){return this.target.stunUntil>this.time||this.target.rootUntil>this.time||!!this.target.displacement||(this.target.slowUntil>this.time&&(this.target.slowStartsAt??0)<=this.time&&(this.target.slowAmount??0)>0);}
  drainViewEvents(){return this.viewEvents.splice(0);}
  stop(){this.stopped=true;if(this.attack){this.attack=null;this.viewEvents.push({type:'cancel'});}this.phase='idle';this.moving=false;}
  observe(events){
    for(const e of events){
      if(e.type==='release'&&e.targetId===this.target.id){
        this.playerReleases++;this.records.set(e.id,{id:e.id,releasedAt:this.time,inBand:this.edgeDistance>this.enemyRange&&this.edgeDistance<=this.playerRange+1e-6,controlled:!!this.controlled,hit:false,settled:false});
      }
      if(e.type==='hit'&&e.targetId===this.target.id&&!e.ability&&(e.isBasicAttack||!e.spellId)){
        const record=this.records.get(e.attackId)??[...this.records.values()].find(r=>!r.hit);
        if(!record||record.hit)continue;record.hit=true;record.hitAt=this.time;record.settlesAt=this.time+.9;this.playerHits++;
      }
      if(e.type==='cancel'&&e.reason!=='end')this.cancelled++;
      if(e.type==='kill'&&e.targetId===this.target.id){this.kills++;this.target.respawnAt=Infinity;}
    }
  }
  settle(){
    for(const r of this.records.values()){
      if(!r.hit||r.settled||this.time<r.settlesAt)continue;
      r.settled=true;r.returned=this.retaliationTimes.some(t=>t>=r.releasedAt-.25&&t<=r.settlesAt);
      if(r.returned){this.trades++;this.cleanStreak=0;this.feedback='TROCA RECEBIDA · saia do alcance antes que Lucian conclua a preparação.';}
      else if(r.inBand&&!r.controlled){this.cleanHits++;this.cleanStreak++;this.bestStreak=Math.max(this.bestStreak,this.cleanStreak);this.feedback='SPACING LIMPO · disparo na sua faixa, sem resposta inimiga.';}
      else {this.cleanStreak=0;this.feedback=r.controlled?'Alvo controlado: acerto registrado, mas spacing exige uma janela sem imobilização.':'Acerto sem troca. Para pontuar spacing, dispare entre 500 e 650 u de borda a borda.';}
    }
  }
  cancelAttack(reason){if(!this.attack)return;this.attack=null;this.deniedAttacks++;this.viewEvents.push({type:'cancel',reason});this.readyAt=Math.max(this.readyAt,this.time+.12);this.inRangeSince=null;}
  startAttack(){
    this.attack={id:++this.serial,startedAt:this.time,releaseAt:this.time+this.windup,windup:this.windup,period:1/this.attackSpeed};
    this.phase='attack';this.facing=Math.atan2(this.player.x-this.position.x,this.player.z-this.position.z);this.viewEvents.push({type:'start',...this.attack});
  }
  update(dt,player,{allowStart=true}={}){
    if(dt<=0)return;this.previousPlayer=copy(this.player);this.player=copy(player);this.target.previousPosition=copy(this.position);this.moving=false;
    const end=this.combat.time+dt;this.samples.push({time:end,...this.player});while(this.samples.length>2&&this.samples[1].time<end-.6)this.samples.shift();
    const sample=[...this.samples].reverse().find(s=>s.time<=end-this.policy.reaction);if(sample)this.observedPlayer=copy(sample);
    for(let left=Math.max(0,end-this.time);left>1e-8;){const step=Math.min(left,1/120);this.time+=step;this.step(step,allowStart);left-=step;}
    this.moving=distance(this.position,this.target.previousPosition)>.01&&this.phase==='run';this.settle();
  }
  step(dt,allowStart){
    for(let i=this.projectiles.length-1;i>=0;i--){const b=this.projectiles[i],d=distance(b.position,this.player),travel=SPACING_LUCIAN.missileSpeed*dt;
      if(d<=travel){this.combat.takeDamage(this.attackDamage);this.retaliationHits++;this.viewEvents.push({type:'hit',position:copy(this.player)});this.projectiles.splice(i,1);}
      else advance(b.position,this.player,SPACING_LUCIAN.missileSpeed,dt);
    }
    this.target.respawnAt=Infinity;
    if(!this.target.alive){this.cancelAttack('death');this.phase='waiting';if(!Number.isFinite(this.respawnAt))this.respawnAt=this.time+1.6;
      if(allowStart&&!this.stopped&&this.time>=this.respawnAt)this.respawn();return;}
    if(this.stopped||!allowStart){this.cancelAttack('end');this.phase='idle';return;}
    this.activeTime+=dt;if(this.edgeDistance>this.enemyRange&&this.edgeDistance<=this.playerRange)this.bandTime+=dt;
    if(this.target.displacement||this.target.stunUntil>this.time){this.cancelAttack('controlled');this.phase='controlled';return;}
    if(this.attack){
      this.phase='attack';this.facing=Math.atan2(this.player.x-this.position.x,this.player.z-this.position.z);
      if(this.edgeDistance>this.enemyRange+1e-7){this.cancelAttack('range');return;}
      if(this.time+1e-8>=this.attack.releaseAt){const a=this.attack;this.attack=null;this.readyAt=a.startedAt+a.period;this.enemyReleases++;this.retaliationTimes.push(this.time);this.projectiles.push({id:a.id,origin:copy(this.position),position:copy(this.position)});this.viewEvents.push({type:'release',id:a.id});this.nextDecision=this.time;}
      return;
    }
    if(this.edgeDistance<=this.enemyRange+1e-7){this.inRangeSince??=this.time;if(this.time>=this.readyAt&&this.time>=this.inRangeSince+this.policy.reaction){this.startAttack();return;}}
    else this.inRangeSince=null;
    if(this.target.rootUntil>this.time){this.phase='controlled';return;}
    if(this.time>=this.nextDecision){this.chooseMovement();this.nextDecision=this.time+this.policy.decision*(.85+this.random()*.3);}
    const before=copy(this.position);this.phase=advance(this.position,this.goal,this.moveSpeed,dt)?'run':'idle';
    if(this.phase==='run')this.facing=Math.atan2(this.position.x-before.x,this.position.z-before.z);
  }
  chooseMovement(){
    const p=this.observedPlayer,dx=this.position.x-p.x,dz=this.position.z-p.z,d=Math.hypot(dx,dz)||1;
    if(this.random()<this.policy.feint)this.side*=-1;
    const cooling=this.readyAt-this.time>.35,wanted=PLAYER_RADIUS+this.target.radius+this.enemyRange+(cooling?this.policy.retreat:-25);
    const lateral=(cooling?85:35)*this.side;
    this.goal={x:p.x+dx/d*wanted-dz/d*lateral,z:p.z+dz/d*wanted+dx/d*lateral};
  }
  respawn(){
    const angle=-Math.PI/2+(this.random()-.5)*1.4;Object.assign(this.position,{x:this.player.x+Math.cos(angle)*720,z:this.player.z+Math.sin(angle)*720});
    Object.assign(this.target,{alive:true,health:this.target.maxHealth,generation:this.target.generation+1,respawnAt:Infinity,rootUntil:0,stunUntil:0,slowUntil:0,slowAmount:0,slowStartsAt:0,previousPosition:copy(this.position)});
    delete this.target.displacement;this.respawnAt=Infinity;this.readyAt=this.time+.8;this.nextDecision=this.time+.3;this.inRangeSince=null;this.goal=copy(this.position);this.respawns++;this.phase='idle';
    this.feedback='Lucian voltou. Construa distância antes de preparar o próximo ataque.';
  }
  summary(){return {playerHits:this.playerHits,playerReleases:this.playerReleases,cleanHits:this.cleanHits,trades:this.trades,retaliationHits:this.retaliationHits,enemyReleases:this.enemyReleases,deniedAttacks:this.deniedAttacks,cancelled:this.cancelled,bandTime:Math.round(this.bandTime*10)/10,activeTime:Math.round(this.activeTime*10)/10,bandPercent:percent(this.bandTime,this.activeTime),cleanStreak:this.cleanStreak,bestStreak:this.bestStreak,edgeDistance:Math.round(this.edgeDistance),kills:this.kills,respawns:this.respawns,enemyAttackSpeed:this.attackSpeed,enemyWindup:this.windup,enemyRange:this.enemyRange,playerRange:this.playerRange};}
}
