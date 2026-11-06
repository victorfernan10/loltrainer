import {advance,effectiveSpeed} from './simulation.js';
import {pointSegmentDistanceXZ} from './dodge-simulation.js';
import {spellData} from './leblanc-data.js';

const copy=p=>({x:p.x,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const pct=(hits,total)=>total?Math.round(hits/total*100):null;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
export const AIM_TARGET={moveSpeed:340,dashRange:600,dashSpeed:1450,dashCooldown:spellData.W.cooldown[5],radius:65};
export const AIM_DIFFICULTIES={
  1:{reaction:.36,decisionMin:1.2,decisionSpan:.75,feintChance:0,dashChance:.25,stepMin:180,stepSpan:170},
  2:{reaction:.23,decisionMin:.55,decisionSpan:.6,feintChance:.25,dashChance:.7,stepMin:100,stepSpan:210},
  3:{reaction:.14,decisionMin:.24,decisionSpan:.48,feintChance:.55,dashChance:1,stepMin:65,stepSpan:200},
};
export function aimTargets(){return [{id:'aim-leblanc',kind:'champion',position:{x:150,z:-660},maxHealth:3500,radius:AIM_TARGET.radius}];}

// This opponent policy is an explicit training design. It receives committed
// visible telegraphs, never the player's mouse, charge aim, or future orders.
// Native movement speed and Distortion range/speed/cooldown do not scale with AI.
export class AimEncounter {
  constructor({combat,random=Math.random,difficulty=2}={}){
    this.combat=combat;this.target=combat.target('aim-leblanc');this.position=this.target.position;
    this.random=random;this.difficulty=clamp(Math.round(difficulty)||2,1,3);this.policy=AIM_DIFFICULTIES[this.difficulty];
    this.time=combat.time??0;this.player={x:0,z:0};this.center=null;this.goal=copy(this.position);this.phase='idle';this.facing=Math.PI;
    this.moving=false;this.stopped=false;this.nextDecision=this.time+.1;this.side=this.random()<.5?-1:1;this.pauseUntil=0;
    this.dash=null;this.dashReadyAt=this.time+({1:3.5,2:2,3:1})[this.difficulty];this.nextProactiveDash=this.dashReadyAt+1.5;
    this.dashes=0;this.feints=0;this.respawns=0;this.respawnAt=Infinity;this.dashHistory=[];this.viewEvents=[];
    this.threats=new Map();this.records=new Map();this.killedGenerations=new Set();this.kills=0;this.streak=0;this.bestStreak=0;
    this.feedback='Treino livre: leia os passos, guarde a habilidade para o fim do dash ou combine E → W → Q.';
    this.target.respawnAt=Infinity;this.target.previousPosition=copy(this.position);
  }
  get active(){return this.target.alive;}
  get pending(){return !!this.dash;}
  get moveSpeed(){const slow=this.target.slowUntil>this.time&&(this.target.slowStartsAt??0)<=this.time?this.target.slowAmount??0:0;return effectiveSpeed(AIM_TARGET.moveSpeed*(1-slow));}
  get dashRemaining(){return Math.max(0,this.dashReadyAt-this.time);}
  bound(point){const c=this.center??this.player;return {x:clamp(point.x,c.x-1050,c.x+1050),z:clamp(point.z,c.z-1100,c.z+420)};}
  stop(){this.stopped=true;}
  drainViewEvents(){return this.viewEvents.splice(0);}
  observe(events){
    for(const event of events){
      if(event.type==='spell-telegraph'&&['Q','W','E','R'].includes(event.key)){
        if(this.records.has(event.id))continue;
        const shape={...event,origin:valid(event.origin)?copy(event.origin):null,point:valid(event.point)?copy(event.point):null,end:valid(event.end)?copy(event.end):null};
        if(!shape.origin||!(shape.point||shape.end))continue;
        shape.point??=copy(shape.end);shape.end??=copy(shape.point);
        shape.startedAt=Number.isFinite(event.startedAt)?event.startedAt:this.combat.time;
        shape.impactAt=Number.isFinite(event.impactAt)?event.impactAt:shape.startedAt+1.5;
        shape.reactAt=shape.startedAt+this.policy.reaction;shape.reacted=false;
        this.threats.set(event.id,shape);
        this.records.set(event.id,{id:event.id,key:event.key,startedAt:shape.startedAt,committedDuringDash:!!this.dash,resolved:false});
      }
      if(event.type==='spell-resolved'){
        const record=this.records.get(event.id);if(!record||record.resolved)continue;
        const time=event.time??this.combat.time,hit=event.targetIds?.includes(this.target.id)??!!event.hit;
        const d=this.dashHistory.findLast(d=>time>=d.startedAt-1e-7&&time<=d.until+.4);
        Object.assign(record,{resolved:true,hit,time,center:hit&&(Array.isArray(event.centerHits)?event.centerHits.includes(this.target.id):Number(event.centerHits)>0),
          duringDash:hit&&!!d&&time<=d.until+1e-7,landing:hit&&!!d&&time>d.until+1e-7,controlled:hit&&event.key!=='E'&&(this.target.stunUntil>time||this.target.rootUntil>time)});
        this.threats.delete(event.id);this.streak=hit?this.streak+1:0;this.bestStreak=Math.max(this.bestStreak,this.streak);
        this.feedback=hit?(record.landing?'ACERTO NO FIM DO DASH · boa leitura do destino.':record.duringDash?'ACERTO DURANTE O DASH · trajetória interceptada.':record.center?'W NO CENTRO · converta a lentidão em outra habilidade.':'ACERTO · acompanhe o próximo passo.'):'ERRO · observe a mudança de direção e a disponibilidade do dash.';
      }
      if(event.type==='kill'&&event.targetId===this.target.id){
        const generation=this.target.generation;if(!this.killedGenerations.has(generation)){this.killedGenerations.add(generation);this.kills++;}
        this.target.respawnAt=Infinity;
      }
    }
  }
  projected(point,seconds){const d=dist(this.position,point);return d?mix(this.position,point,Math.min(1,this.moveSpeed*Math.max(0,seconds)/d)):copy(this.position);}
  missilePosition(t){
    const current=this.combat.visibleThreats?.().find(v=>v.id===t.id);
    if(valid(current?.position))return current.position;
    const length=dist(t.origin,t.end),travel=Math.max(0,this.time-t.startedAt-.25)*(t.speed||1400);
    return mix(t.origin,t.end,length?Math.min(1,travel/length):0);
  }
  margin(t,point){
    const radius=this.target.radius??65;
    if(t.kind==='circle')return dist(point,t.point)-(t.radius??200)-radius;
    if(t.kind==='missile'){
      const start=this.missilePosition(t),dx=t.end.x-t.origin.x,dz=t.end.z-t.origin.z,length=Math.hypot(dx,dz)||1;
      if(((point.x-start.x)*dx+(point.z-start.z)*dz)/length<-(t.radius??60)-radius)return Infinity;
      return pointSegmentDistanceXZ(point,start,t.end)-(t.radius??60)-radius;
    }
    return pointSegmentDistanceXZ(point,t.origin,t.end)-(t.width??160)/2-radius;
  }
  horizon(t){
    if(t.kind!=='missile')return Math.max(0,t.impactAt-this.time);
    return Math.max(0,dist(this.missilePosition(t),this.position)/(t.speed||1400));
  }
  escapeCandidates(t){
    const origin=this.position,candidates=[];
    const dx=t.kind==='circle'?origin.x-t.point.x:t.end.x-t.origin.x,dz=t.kind==='circle'?origin.z-t.point.z:t.end.z-t.origin.z;
    const basis=t.kind==='circle'?Math.atan2(dz,dx):Math.atan2(dz,dx)+Math.PI/2;
    for(const length of [150,290,450,580])for(const angle of [basis,basis+Math.PI,basis+.55,basis-.55,basis+Math.PI+.55,basis+Math.PI-.55])candidates.push(this.bound({x:origin.x+Math.cos(angle)*length,z:origin.z+Math.sin(angle)*length}));
    return candidates;
  }
  chooseDodge(){
    const actionable=[...this.threats.values()].filter(t=>!t.reacted&&this.time+1e-8>=t.reactAt&&this.time<t.impactAt+.06);
    for(const t of actionable){
      t.reacted=true;
      const remaining=this.horizon(t),predicted=this.projected(this.goal,remaining);
      if(this.margin(t,this.position)>40&&this.margin(t,predicted)>35)continue;
      const candidates=this.escapeCandidates(t);
      const known=[...this.threats.values()].filter(x=>this.time>=x.reactAt);
      const safety=point=>Math.min(...known.map(x=>this.margin(x,point)));
      const scored=candidates.map(point=>({point,walk:safety(this.projected(point,remaining)),end:safety(point),length:dist(point,this.position)}));
      scored.sort((a,b)=>b.walk-a.walk||a.length-b.length);
      const walking=scored[0];if(!walking)continue;
      if(this.time>=this.dashReadyAt&&walking.walk<30&&this.random()<this.policy.dashChance){
        const dash=scored.filter(c=>c.length>=200&&c.length/AIM_TARGET.dashSpeed<remaining&&c.end>35).sort((a,b)=>b.end-a.end||a.length-b.length)[0];
        if(dash&&this.beginDash(dash.point)){this.feedback='Dash comprometido: observe o destino, ele não muda durante o avanço.';return true;}
      }
      this.goal=walking.point;this.nextDecision=this.time+Math.min(.65,remaining+.12);this.pauseUntil=0;
      return true;
    }
    return false;
  }
  chooseFootwork(){
    const p=this.policy,dx=this.position.x-this.player.x,dz=this.position.z-this.player.z,d=Math.hypot(dx,dz)||1;
    if(this.random()<p.feintChance){this.side*=-1;this.feints++;}
    else if(this.random()<.22)this.side*=-1;
    const lateral=p.stepMin+this.random()*p.stepSpan;
    const ideal=620+this.random()*240,radial=clamp(ideal-d,-140,140);
    this.goal=this.bound({x:this.position.x-dz/d*this.side*lateral+dx/d*radial,z:this.position.z+dx/d*this.side*lateral+dz/d*radial});
    this.nextDecision=this.time+p.decisionMin+this.random()*p.decisionSpan;
    // Very short stops bait an extrapolated shot, but are not animation spam.
    if(this.difficulty>=2&&this.random()<.12)this.pauseUntil=this.time+.09+this.random()*.08;
    if(!this.stopped&&this.time>=this.nextProactiveDash&&this.time>=this.dashReadyAt){
      this.nextProactiveDash=this.time+2+this.random()*3;
      if(this.random()<({1:.15,2:.35,3:.55})[this.difficulty]){
        const side=this.random()<.5?-1:1,end=this.bound({x:this.position.x-dz/d*side*380,z:this.position.z+dx/d*side*380});
        this.beginDash(end);
      }
    }
  }
  beginDash(point){
    if(this.dash||this.time<this.dashReadyAt||this.target.stunUntil>this.time||this.target.rootUntil>this.time||this.target.displacement)return false;
    const origin=copy(this.position),d=dist(origin,point);if(d<80)return false;
    const end=mix(origin,point,Math.min(1,AIM_TARGET.dashRange/d)),duration=dist(origin,end)/AIM_TARGET.dashSpeed;
    const dash={id:++this.dashes,origin,end,startedAt:this.time,until:this.time+duration,duration,speed:AIM_TARGET.dashSpeed,generation:this.target.generation};
    this.dash=dash;this.target.aimDash=dash;this.dashHistory.push({...dash});this.dashHistory=this.dashHistory.slice(-20);
    this.dashReadyAt=this.time+AIM_TARGET.dashCooldown;this.nextProactiveDash=this.dashReadyAt+1+this.random()*2;
    this.phase='dash';this.facing=Math.atan2(end.x-origin.x,end.z-origin.z);this.pauseUntil=0;
    this.viewEvents.push({type:'spell',key:'W',ability:'W',...dash,point:copy(end)});return true;
  }
  respawn(){
    const center=this.center??this.player;Object.assign(this.position,{x:center.x+(this.random()-.5)*500,z:center.z-620-this.random()*170});
    Object.assign(this.target,{alive:true,health:this.target.maxHealth,generation:this.target.generation+1,respawnAt:Infinity,stunUntil:0,rootUntil:0,slowUntil:0,slowStartsAt:0,slowAmount:0,nearsightUntil:0,quinnMarkUntil:0,sigils:[],shield:0,previousPosition:copy(this.position)});
    delete this.target.displacement;delete this.target.aimDash;this.dash=null;this.respawnAt=Infinity;this.phase='idle';this.respawns++;
    this.goal=copy(this.position);this.nextDecision=this.time+.2;this.threats.clear();this.pauseUntil=0;
    this.feedback='Alvo renovado. Continue livremente com qualquer combinação de habilidades.';
  }
  update(dt,player,{allowStart=true}={}){
    if(dt<=0)return;
    this.player=copy(player);this.center??=copy(player);this.target.previousPosition=copy(this.position);this.moving=false;
    const end=(this.combat.time??this.time)+dt;let left=Math.max(0,end-this.time);
    while(left>1e-8){const step=Math.min(left,1/120);this.time+=step;this.step(step,allowStart);left-=step;}
    this.moving=dist(this.target.previousPosition,this.position)>.01&&this.phase!=='dash';
  }
  step(dt,allowStart){
    for(const [id,t] of this.threats)if(this.time>t.impactAt+.12)this.threats.delete(id);
    this.target.respawnAt=Infinity;
    if(!this.target.alive){
      this.phase='waiting';this.dash=null;delete this.target.aimDash;
      if(!Number.isFinite(this.respawnAt))this.respawnAt=this.time+1.8;
      if(allowStart&&!this.stopped&&this.time>=this.respawnAt)this.respawn();return;
    }
    if(this.target.displacement){this.dash=null;delete this.target.aimDash;this.phase='controlled';return;}
    // Stuns/roots prevent new movement orders. They do not teleport or erase an
    // already committed ordinary dash; its endpoint remains punishable.
    if(this.dash){
      const d=this.dash,t=clamp((this.time-d.startedAt)/d.duration,0,1);Object.assign(this.position,mix(d.origin,d.end,t));this.phase='dash';
      if(t>=1){this.dash=null;delete this.target.aimDash;this.goal=copy(this.position);this.nextDecision=this.time+.08;this.phase='idle';this.viewEvents.push({type:'spell-impact',key:'W',position:copy(this.position),radius:80});}
      return;
    }
    if(this.target.stunUntil>this.time||this.target.rootUntil>this.time){this.phase='controlled';return;}
    const finishing=this.stopped||!allowStart;
    // Ending a block must not turn a fleeing opponent into a stationary dummy
    // before already committed shots land. No new patrol or proactive dash is
    // scheduled, but existing movement and visible-shot responses still finish.
    if(finishing&&!this.threats.size){this.phase='idle';return;}
    const dodging=this.chooseDodge();
    if(!finishing&&!this.dash&&!dodging&&this.time>=this.nextDecision)this.chooseFootwork();
    if(this.dash)return;
    if(this.time<this.pauseUntil){this.phase='idle';return;}
    const before=copy(this.position);const moved=advance(this.position,this.goal,this.moveSpeed,dt);this.phase=moved?'run':'idle';
    if(moved)this.facing=Math.atan2(this.position.x-before.x,this.position.z-before.z);
  }
  summary(){
    const done=[...this.records.values()].filter(r=>r.resolved),hits=done.filter(r=>r.hit),byAbility={};
    for(const key of ['Q','W','E','R']){const rows=done.filter(r=>r.key===key),hit=rows.filter(r=>r.hit).length;byAbility[key]={casts:rows.length,hits:hit,misses:rows.length-hit,accuracy:pct(hit,rows.length),centerHits:rows.filter(r=>r.center).length};}
    return {casts:done.length,hits:hits.length,accuracy:pct(hits.length,done.length),pendingCasts:this.records.size-done.length,byAbility,streak:this.streak,bestStreak:this.bestStreak,
      dashHits:hits.filter(r=>r.duringDash).length,landingHits:hits.filter(r=>r.landing).length,controlledHits:hits.filter(r=>r.controlled).length,wCenters:byAbility.W.centerHits,
      dashes:this.dashes,feints:this.feints,kills:this.kills,respawns:this.respawns,reactionMs:Math.round(this.policy.reaction*1000),dashCooldown:AIM_TARGET.dashCooldown};
  }
}
