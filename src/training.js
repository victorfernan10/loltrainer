import {pointSegmentDistanceXZ,hazardDistance} from './dodge-simulation.js';

export const drills = {
  vault:{name:'Quinn × LeBlanc',subtitle:'Intercepte Distorção com Salto.',tip:'Mantenha o cursor sobre LeBlanc. Use E durante o avanço do W; o contato antes da aterrissagem cancela o dano. E e mana renovam entre tentativas.',pairChance:0,leadChance:0},
  lane:{name:'Lane · poke no last hit',subtitle:'Leia os minions e castigue a animação de farm.',tip:'Onda de 7 por lado: 3 guerreiros, 1 catapulta, 3 magos. Acerte a adversária enquanto ela prepara o último golpe.',pairChance:0,leadChance:0},
  ahri:{name:'Esquiva · Ahri',subtitle:'Desvie do Charme e das duas passagens do orbe.',tip:'Saia lateralmente do Charme e acompanhe a posição da Ahri: a volta do Q segue até ela.',pairChance:0,leadChance:.45},
  locke:{name:'Esquiva · Locke',subtitle:'Três pregos. Três decisões de movimento.',tip:'Mude de direção entre os Qs. Cada lançamento escolhe uma nova mira; acertos acumulam pregos e lentidão.',pairChance:0,leadChance:.45},
  yone:{name:'Duelo · Yone',subtitle:'Leia a investida e escape do espírito.',tip:'Dê passos laterais nos Qs. Ao ver duas cargas, espere o tornado; ataque nos intervalos e acompanhe o retorno do E.',pairChance:0,leadChance:.45},
  precision: {name:'Passos curtos',subtitle:'Leia a linha. Saia com um comando preciso.',tip:'Clique perto do campeão e mova-se para o lado da habilidade.',pairChance:0,leadChance:0},
  rhythm: {name:'Quebra de ritmo',subtitle:'Mude de direção contra uma mira que antecipa você.',tip:'Varie sua direção depois do aviso. Andar sempre em linha reta facilita a previsão.',pairChance:0,leadChance:.7},
  pressure: {name:'Esquiva sob pressão',subtitle:'Até três ameaças, ângulos cruzados e ataques em área.',tip:'Intensidade traz até três campeões. Leia a primeira conjuração, reposicione e prepare uma nova saída para a próxima.',pairChance:1,leadChance:.45},
  combat: {name:'Kiting sob pressão',subtitle:'Ataque entre as esquivas.',tip:'Alterne direito para andar e esquerdo para atacar. Mova-se depois que o ataque sair.',pairChance:.35,leadChance:.5},
};

export function seededRandom(seed) {
  let state=seed>>>0;
  return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function shuffled(items,random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export const point=p=>({x:p.x,z:p.z});
export const median=values=>{if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
export function settingsKey(config){const key=[config.trainingProfile??'legacy',config.trainingRuleset??0,config.drill,config.difficulty,config.duration,config.speed,config.closeRadius,config.pace,[...config.skills].sort()];if(config.drill==='combat'||config.drill==='yone'||config.drill==='lane'||config.drill==='vault')key.push(config.level,config.attackSpeed,config.attackPriority,config.bindLeft,config.combatHazards,config.combatCircuit);if(config.champion&&config.champion!=='kayle')key.push(config.champion,config.abilityPower??0,config.unlimitedMana??true);if(config.drill==='yone')key.push(config.yonePattern??'eq',config.yoneBonusAS??80,config.yoneStacks??2,config.yoneTelegraphs??true,config.yoneRatingVersion??1);if(['ahri','locke'].includes(config.drill))key.push(config.matchupPattern??'mixed',config.matchupTelegraphs??true,config.matchupVersion??1);if(config.champion==='syndra')key.push(config.abilityHaste??0,config.syndraSplinters??-1,'syndra-v1');if(config.drill==='lane')key.push(config.laneCoach??true,config.laneVersion??1);if(config.champion==='quinn')key.push(config.bonusAD??0,config.critChance??0,config.abilityHaste??0,'quinn-v1');if(config.drill==='vault')key.push(config.vaultVersion??1);if(config.playlistId)key.push('playlist-v1');return JSON.stringify(key);}

export function feedbackFor(shot) {
  if(shot.kind==='circle'){if(!shot.hit)return shot.threatened?'Você saiu da área antes da erupção.':'Você manteve distância da área anunciada.';return shot.firstCommandAt==null?'O pilar surgiu na sua posição. Mantenha-se em movimento e leia o sinal no chão.':'A erupção encontrou você dentro da área. Evite voltar ao centro marcado enquanto lê o outro ataque.';}
  const lateral=Math.abs((shot.end.x-shot.start.x)*shot.direction.z-(shot.end.z-shot.start.z)*shot.direction.x);
  if(!shot.hit) return !shot.threatened?'Você já estava fora da linha.':'Você saiu da trajetória a tempo.';
  if(shot.firstCommandAt==null)return 'Nenhum novo comando após o aviso. Experimente um passo lateral assim que ler a linha.';
  const safeEarlier=shot.path.some(p=>pointSegmentDistanceXZ(p,shot.origin,shot.endpoint)>shot.radius+8);
  if(safeEarlier)return 'Você passou por uma posição segura e voltou à trajetória. Revise os últimos cliques.';
  if(lateral<shot.radius*.6)return 'O deslocamento acompanhou a habilidade. Um passo perpendicular abre espaço mais rápido.';
  return 'O passo lateral não terminou a tempo. Antecipe o comando e confira a distância até sair da linha.';
}

export class TrainingSession {
  constructor(config) {
    this.config={...config,skills:[...config.skills]};this.random=seededRandom(config.seed);
    this.time=0;this.state='running';this.shots=[];this.clicks=[];this.nextId=1;this.combat=null;
  }
  tick(dt){if(this.state==='running'||this.state==='draining'){this.time+=dt;if(this.state==='running'&&this.time>=this.config.duration)this.state='draining';}}
  beginShot({skill,origin,endpoint,direction,position,target,velocity,aimMode,radius}){
    const shot={id:this.nextId++,skill:skill.id,name:`${skill.champion} ${skill.key}`,startedAt:this.time,
      kind:skill.kind,origin:point(origin),endpoint:point(endpoint),direction:point(direction),start:point(position),initialTarget:point(target),velocity:point(velocity),aimMode,radius,
      parameters:{kind:skill.kind,range:skill.range,width:skill.width,hitWidth:skill.hitWidth,speed:Number.isFinite(skill.speed)?skill.speed:null},firstDodgeAt:null,warning:skill.warning,threatened:hazardDistance(position,skill,origin,endpoint)<=radius,
      path:[{...point(position),t:0}],commands:[],firstCommandAt:null,minClearance:null,resolved:false};
    this.shots.push(shot);return shot;
  }
  sample(position){for(const shot of this.shots){if(shot.resolved)continue;const t=this.time-shot.startedAt;if(t-shot.path.at(-1).t>=.045)shot.path.push({...point(position),t});}}
  command(position,target,kind='move'){
    if(this.state!=='running'&&this.state!=='draining')return;
    const click={t:this.time,from:point(position),to:point(target),kind,distance:Math.hypot(target.x-position.x,target.z-position.z)};
    if(kind==='move')this.clicks.push(click);
    for(const shot of this.shots){if(shot.resolved)continue;shot.firstCommandAt??=this.time;
      if((kind==='move'||kind==='flash')&&shot.firstDodgeAt==null){
        const d=click.distance,k=Math.min(1,150/(d||1)),next={x:position.x+(target.x-position.x)*k,z:position.z+(target.z-position.z)*k};
        if(hazardDistance(next,{kind:shot.kind},shot.origin,shot.endpoint)>hazardDistance(position,{kind:shot.kind},shot.origin,shot.endpoint)+8)shot.firstDodgeAt=this.time;
      }
      if(kind==='flash'){shot.path.push({...point(position),t:this.time-shot.startedAt},{...point(target),t:this.time-shot.startedAt,blink:true});}
      shot.commands.push({...click,t:this.time-shot.startedAt});}
  }
  clearance(shot,value){if(shot&&!shot.resolved)shot.minClearance=shot.minClearance==null?value:Math.min(shot.minClearance,value);}
  resolve(shot,hit,position){
    if(!shot||shot.resolved)return;
    shot.resolved=true;shot.hit=hit;shot.end=point(position);shot.endedAt=this.time;
    shot.path.push({...point(position),t:this.time-shot.startedAt});shot.feedback=feedbackFor(shot);
  }
  summary(){
    const resolved=this.shots.filter(s=>s.resolved),hit=resolved.filter(s=>s.hit).length;
    const delays=resolved.filter(s=>s.threatened&&s.firstCommandAt!=null).map(s=>Math.round(1000*(s.firstCommandAt-s.startedAt)));
    let streak=0,bestStreak=0;for(const shot of [...resolved].sort((a,b)=>a.endedAt-b.endedAt)){streak=shot.hit?0:streak+1;bestStreak=Math.max(streak,bestStreak);}
    const bySkill=this.config.skills.map(id=>{const shots=resolved.filter(s=>s.skill===id);return {id,total:shots.length,hits:shots.filter(s=>s.hit).length};});
    const threatened=resolved.filter(s=>s.threatened||s.hit),avoided=threatened.filter(s=>!s.hit).length;
    const lateralDelays=threatened.filter(s=>s.firstDodgeAt!=null).map(s=>Math.round((s.firstDodgeAt-s.startedAt)*1000));
    const short=this.clicks.filter(c=>c.distance<=this.config.closeRadius).length;
    return {matchup:this.matchup??null,flashUses:this.flashUses??0,threats:threatened.length,threatAccuracy:threatened.length?Math.round(100*avoided/threatened.length):null,lateralCommandMs:median(lateralDelays),lateralSamples:lateralDelays.length,assessmentReady:threatened.length>=20,total:resolved.length,hits:hit,dodged:resolved.length-hit,accuracy:resolved.length?Math.round(100*(resolved.length-hit)/resolved.length):null,
      firstCommandMs:median(delays),commandSamples:delays.length,clickMedian:median(this.clicks.map(c=>c.distance)),
      shortClicks:this.clicks.length?Math.round(100*short/this.clicks.length):null,clicks:this.clicks.length,streak,bestStreak,bySkill,combat:this.combat};
  }
  report(){return {version:1,date:new Date().toISOString(),config:this.config,summary:this.summary(),shots:this.shots.filter(s=>s.resolved),key:settingsKey(this.config)};}
}

export function recommendation(summary){
  if(summary.combat){
    const c=summary.combat;
    if(c.playerHealth<=0)return 'A vida acabou antes do tempo. Priorize sair das habilidades e retome o ataque na próxima janela segura.';
    if(c.yone)return `Você concluiu ${c.yone.cleanRounds} investidas sem ser atingido. Compare a esquiva de Q e Q3; pratique um passo lateral na conjuração, depois retome os ataques. O E repetiu ${c.yone.repeatDamage} de dano nos retornos.`;
    if(c.released===0)return 'Use A + clique esquerdo, ou vincule ataque-movimento ao esquerdo. Espere o primeiro ataque sair antes de voltar a andar.';
    if(c.cancelled>c.released*.35)return 'Vários ataques foram interrompidos antes do disparo. No aquecimento, pratique mover logo após o projétil sair; continue cancelando quando precisar desviar.';
    if(c.circuit&&c.missedMarks>c.completedMarks)return 'Pratique a troca de alvo sem habilidades primeiro. Faça dois disparos no alvo marcado, leia a nova marca e redirecione o ataque. A prioridade pelo cursor ou o clique direito no alvo facilita essa troca.';
    if(c.kiteOpportunities>=3&&c.kiteSteps<c.kiteOpportunities*.5)return 'Você atacou várias vezes da mesma posição. No aquecimento, dê um passo após o disparo e retome o ataque. No combate, escolha uma direção segura antes de tentar cumprir a meta de 60 unidades.';
    return `Você acertou ${c.hits} ataques e manteve ${c.playerHealth} de vida. Compare dano e esquiva juntos no próximo bloco com os mesmos ajustes.`;
  }
  if(!summary.total)return 'Nenhuma tentativa concluída. Inicie um bloco e espere as habilidades terminarem.';
  if(summary.threats!=null&&summary.threats<20)return `Amostra de ${summary.threats}/20 situações sob ameaça. Repita o bloco antes de avaliar a consistência; habilidades que já passariam longe não aumentam essa taxa.`;
  const weakest=summary.bySkill.filter(s=>s.total>=3).sort((a,b)=>(b.hits/b.total)-(a.hits/a.total))[0];
  if(weakest&&weakest.hits/weakest.total>=.4)return `Repita as tentativas de ${weakest.id.replace(/([A-Z])/g,' $1')} em que foi atingido antes de aumentar a pressão.`;
  if((summary.threatAccuracy??summary.accuracy)<70)return 'Volte a Passos curtos. Leia a linha e pratique uma saída lateral de cada vez.';
  if(summary.shortClicks!=null&&summary.shortClicks<60)return 'Sua esquiva está funcionando. Agora aproxime os cliques da Kayle para reduzir deslocamentos desnecessários.';
  if((summary.threatAccuracy??summary.accuracy)>=85)return 'Bom controle neste bloco. Experimente Quebra de ritmo ou aumente a pressão mantendo a mesma velocidade.';
  return 'Repita este bloco com os mesmos ajustes e tente aumentar a consistência.';
}
