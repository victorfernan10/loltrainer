import {spellData} from './leblanc-data.js';

const copy=p=>({x:p.x,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const median=values=>{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
export const VAULT_LEBLANC={range:600,speed:1450,radius:220,moveSpeed:340};
export function vaultTargets(){return [{id:'vault-leblanc',kind:'champion',position:{x:0,z:550},maxHealth:3000,radius:65}];}

// Practice scheduler. Distortion is committed movement and only explodes when
// its path finishes. QuinnCombat solves relative swept E contact against the
// published vaultDash trajectory, then delivers the exact impact timestamp.
export class VaultEncounter {
  constructor({combat,random=Math.random,difficulty=2,interval=1,advanced=false}={}){
    this.advanced=advanced;
    this.combat=combat;this.target=combat.target('vault-leblanc');this.position=this.target.position;
    this.random=random;this.difficulty=difficulty;this.interval=Math.max(.2,interval);
    this.time=combat.time??0;this.phase='waiting';this.nextRoundAt=this.time+.45;this.action=null;this.serial=0;this.rounds=0;
    this.events=[];this.viewEvents=[];this.records=[];this.current=null;this.facing=0;this.moving=false;this.stopped=false;this.player=null;
    this.feedback='Espere o avanço da LeBlanc e use E sobre ela antes da aterrissagem.';
    const rank=[1,1,1,2,3,3,4,4,5,5,5,5,5,5,5,5,5,5][Math.max(0,Math.min(17,(combat.level??6)-1))];
    this.damage=spellData.W.values.BaseDamage[rank];this.target.alive=false;this.target.respawnAt=Infinity;
  }
  get active(){return this.phase!=='waiting'&&this.target.alive;}
  get pending(){return ['dash','recovery','interrupted'].includes(this.phase);}
  get moveSpeed(){return VAULT_LEBLANC.moveSpeed;}
  startRound(player){
    const angle=this.random()*Math.PI*2,near=({1:560,2:480,3:410})[this.difficulty]??480,r=near+this.random()*70;
    Object.assign(this.position,{x:player.x+Math.sin(angle)*r,z:player.z+Math.cos(angle)*r});
    Object.assign(this.target,{alive:true,health:this.target.maxHealth,generation:this.target.generation+1,respawnAt:Infinity,stunUntil:0,rootUntil:0,slowUntil:0,quinnMarkUntil:0,nearsightUntil:0,sigils:[]});
    delete this.target.displacement;delete this.target.vaultDash;delete this.target.dashInterruptedAt;
    this.combat.resetVaultPractice?.();this.combat.playerHealth=this.combat.maxPlayerHealth;this.rounds++;this.phase='prepare';this.action=null;
    this.castAt=this.time+.4+this.random()*.5;this.retireAt=this.time+7;
    this.side=this.random()<.5?-1:1;this.facing=Math.atan2(player.x-this.position.x,player.z-this.position.z);
    this.current={id:this.rounds,spawnedAt:this.time,startedAt:null,until:null,eCastAt:null,impactAt:null,result:null,wHit:false,resolved:false};
    this.current.patience=this.advanced&&this.difficulty>1&&this.random()<({2:.2,3:.3})[this.difficulty];
    this.patienceEndsAt=this.castAt+.55+this.random()*.4;
    this.records.push(this.current);this.feedback='Leia a animação. E, mana e vida renovados para esta tentativa.';
    this.events.push({type:'round',number:this.rounds});
  }
  beginDash(player){
    const origin=copy(this.position),length=distance(origin,player),scale=Math.min(1,VAULT_LEBLANC.range/(length||1));
    const end={x:origin.x+(player.x-origin.x)*scale,z:origin.z+(player.z-origin.z)*scale},duration=Math.max(.001,distance(origin,end)/VAULT_LEBLANC.speed);
    this.action={id:++this.serial,origin,end,startedAt:this.time,until:this.time+duration,duration,speed:VAULT_LEBLANC.speed};
    this.target.vaultDash=this.action;this.phase='dash';this.facing=Math.atan2(end.x-origin.x,end.z-origin.z);
    Object.assign(this.current,{startedAt:this.time,until:this.action.until});
    this.viewEvents.push({type:'spell',key:'W',ability:'W',...this.action,point:copy(end)});
  }
  observe(events){
    if(!this.current||!this.active)return;
    for(const event of events){
      if(event.type==='spell'&&event.key==='E'&&event.phase!=='rebound'&&event.targetId===this.target.id){
        this.current.eCastAt??=event.startedAt??this.combat.time;
      }
      if(event.type!=='vault-impact'||event.targetId!==this.target.id)continue;
      // Ignore duplicate impact delivery. Late input can never undo a landed W.
      if(this.current.impactAt!=null)continue;
      const time=event.time??this.combat.time;this.current.impactAt=time;
      const dash=this.action;
      if(this.phase==='dash'&&dash&&time>=dash.startedAt&&time<dash.until-1e-8){
        this.current.result='interrupted';this.phase='interrupted';this.stateUntil=Math.max(time+.65,this.target.stunUntil??time);
        // The combat simulation may already have advanced the knockback beyond
        // the contact point; do not replace its physical displacement here.
        if(!this.target.displacement)Object.assign(this.position,event.position);
        delete this.target.vaultDash;this.target.dashInterruptedAt=time;
        this.feedback='INTERROMPIDO · o E encontrou a LeBlanc durante o avanço.';
        this.viewEvents.push({type:'interrupted',time,until:this.stateUntil,position:copy(event.position)});
        this.events.push({type:'interrupted',time,round:this.current.id});
      }else if(this.current.startedAt==null||time<this.current.startedAt){
        this.current.result='early';this.feedback='CEDO · o E acertou antes de o W começar. Espere o avanço.';
        this.castAt=Math.max(this.castAt,this.target.stunUntil??time+.25);
      }else{
        this.current.result='late';this.feedback='TARDE · a LeBlanc já tinha concluído o trajeto do W.';
      }
    }
  }
  finishDash(player){
    const a=this.action;if(!a)return;
    delete this.target.vaultDash;
    // Explode at the committed destination, even when a late E knocked the
    // model away before this renderer-frame update received its event.
    if(!this.target.displacement)Object.assign(this.position,a.end);
    const hit=distance(a.end,player)<=VAULT_LEBLANC.radius+65;
    this.current.wHit=hit;if(hit)this.combat.takeDamage(this.damage);
    this.viewEvents.push({type:'spell-impact',key:'W',position:copy(a.end),radius:VAULT_LEBLANC.radius});
    this.events.push({type:'landed',hit,position:copy(a.end),round:this.current.id});
    if(!this.current.result)this.feedback=hit?'W ACERTOU · encontre a LeBlanc com E antes de ela aterrissar.':'W DESVIADO · sair da área evita dano, mas não conta como interrupção.';
    this.phase='recovery';this.stateUntil=this.time+.8;
  }
  finishRound(){
    if(this.current&&!this.current.resolved){this.current.resolved=true;this.current.completedAt=this.time;if(this.current.patience&&this.current.patienceCompleted){this.current.result=this.current.eCastAt==null?'held':'false-start';this.feedback=this.current.result==='held'?'BOA LEITURA · ela só caminhou e você guardou o E.':'PRECIPITADO · não houve W. Espere a investida real.';}else this.current.result??=this.current.startedAt==null?'no-cast':'missed';}
    this.phase='waiting';this.target.alive=false;this.target.respawnAt=Infinity;this.action=null;delete this.target.vaultDash;
    this.nextRoundAt=this.time+this.interval*(.75+this.random()*.5);
  }
  update(dt,player,{allowStart=true}={}){
    if(dt<=0)return;
    // Parent advances combat first; all published trajectory timestamps use the
    // same simulation clock, avoiding animation-frame dependent cancellation.
    this.time=this.combat.time;this.player=copy(player);this.moving=false;
    if(this.phase==='waiting'){
      if(allowStart&&!this.stopped&&this.time>=this.nextRoundAt&&!this.combat.busy)this.startRound(player);
      return;
    }
    this.target.respawnAt=Infinity;
    if(!this.target.alive){this.feedback='LeBlanc abatida. A próxima tentativa restaura o alvo.';this.finishRound();return;}
    if(this.phase==='dash'){
      if(this.time+1e-8>=this.action.until)this.finishDash(player);
      else if(!this.target.displacement){const t=Math.max(0,(this.time-this.action.startedAt)/(this.action.until-this.action.startedAt));Object.assign(this.position,mix(this.action.origin,this.action.end,t));}
      return;
    }
    if(this.phase==='recovery'||this.phase==='interrupted'){
      if(this.time>=this.stateUntil&&!this.combat.busy)this.finishRound();return;
    }
    if(!allowStart||this.stopped){this.finishRound();return;}
    if(this.current.patience&&this.time>=this.patienceEndsAt&&!this.combat.busy){this.current.patienceCompleted=true;this.finishRound();return;}
    if(this.time>=this.retireAt){this.feedback='Sem avanço nesta tentativa: o alvo perdeu visão ou ficou impedido de agir.';this.finishRound();return;}
    if(this.target.stunUntil>this.time||this.target.rootUntil>this.time||this.target.displacement)return;
    const visible=!(this.target.nearsightUntil>this.time&&distance(this.position,player)>(this.target.nearsightRange??300));
    if(!visible)return;
    if(!this.current.patience&&this.time>=this.castAt){this.beginDash(player);return;}
    // Short lateral footwork, independent of cursor and future player orders.
    const dx=player.x-this.position.x,dz=player.z-this.position.z,d=Math.hypot(dx,dz)||1;
    const slow=this.target.slowUntil>this.time?1-(this.target.slowAmount??0):1,step=Math.min(dt,.05)*VAULT_LEBLANC.moveSpeed*slow*.45;
    this.position.x+=-dz/d*this.side*step;this.position.z+=dx/d*this.side*step;this.moving=step>0;
    this.facing=Math.atan2(-dz*this.side,dx*this.side);
  }
  stop(){this.stopped=true;if(this.phase==='prepare')this.finishRound();}
  drainEvents(){return this.events.splice(0);}
  drainViewEvents(){return this.viewEvents.splice(0);}
  summary(){
    const done=this.records.filter(r=>r.resolved),casts=done.filter(r=>r.startedAt!=null),wins=casts.filter(r=>r.result==='interrupted');
    const patience=done.filter(r=>r.patienceCompleted),held=patience.filter(r=>r.result==='held').length;
    const reaction=wins.filter(r=>r.eCastAt!=null&&r.eCastAt>=r.startedAt).map(r=>Math.round((r.eCastAt-r.startedAt)*1000));
    return {rounds:this.rounds,attempts:casts.length,interrupted:wins.length,patienceTrials:patience.length,held,falseStarts:patience.length-held,decisionAccuracy:casts.length+patience.length?Math.round((wins.length+held)/(casts.length+patience.length)*100):null,early:done.filter(r=>!r.patience&&r.result==='early').length,late:done.filter(r=>r.result==='late').length,missed:casts.filter(r=>r.result==='missed').length,wHits:casts.filter(r=>r.wHit).length,accuracy:casts.length?Math.round(wins.length/casts.length*100):null,reactionMs:median(reaction),reactionSamples:reaction.length,contactMs:median(wins.map(r=>Math.round((r.impactAt-r.startedAt)*1000))),practiceResets:this.rounds};
  }
}
