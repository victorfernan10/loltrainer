import {PLAYLIST_MODES} from './playlist.js';
import {TRAINING_RULESET,trainingConfig} from './training-rules.js';
import {drills,recommendation,settingsKey} from './training.js';
import {dodgeSkills as baseSkills} from './dodge-simulation.js';
import {yoneSkills} from './yone-encounter.js';
import {yoneQCast,yoneRating} from './yone-data.js';
import {matchupSkills,matchupProfiles} from './matchup-data.js';
const dodgeSkills={...baseSkills,...yoneSkills,...matchupSkills};
import {champions,championRange} from './champions.js';

const $=id=>document.getElementById(id),historyKey='kayle:training-history:v1';
const percentage=n=>n==null?'—':`${n}%`;
const duration=seconds=>{const remaining=Math.ceil(Math.max(0,seconds));return `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;};
function readHistory(){try{const data=JSON.parse(localStorage.getItem(historyKey)||'[]');return Array.isArray(data)?data.filter(r=>r?.version===1&&drills[r.config?.drill]&&r.summary&&Array.isArray(r.shots)).slice(-20):[];}catch{return [];}}
function element(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}

export class TrainingUI {
  constructor(callbacks){
    this.callbacks=callbacks;this.drill='precision';this.history=readHistory();this.report=null;
    for(const button of document.querySelectorAll('button[data-drill]'))button.onclick=()=>this.selectDrill(button.dataset.drill);
    $('difficulty').oninput=()=>this.updateYoneRating();
    $('duration').onchange=()=>$('sessionClock').textContent=duration(+$('duration').value);
    $('closeRadius').oninput=()=>$('closeRadiusValue').textContent=`${$('closeRadius').value} u`;
    $('attackSpeed').oninput=()=>$('attackSpeedValue').textContent=Number($('attackSpeed').value).toFixed(2).replace('.',',')+' / s';
    $('finishSession').onclick=()=>callbacks.finish();
    $('openPlaylist').onclick=()=>this.openPlaylist();
    $('closePlaylist').onclick=()=>$('playlistDialog').close();
    $('playlistDuration').onchange=()=>this.updatePlaylistEstimate();
    $('playlistForm').onsubmit=event=>{event.preventDefault();const options={duration:+$('playlistDuration').value,difficulty:+$('playlistDifficulty').value};$('playlistDialog').close();callbacks.playlist(options);};
    $('retryPlaylist').onclick=()=>callbacks.retryPlaylist();
    $('shotPicker').onchange=()=>{this.reviewIndex=+$('shotPicker').value;$('reviewTime').value=1000;this.drawReview();};
    $('reviewTime').oninput=()=>this.drawReview();
    $('closeResults').onclick=()=>this.closeReview();
    $('backToPlaylist').onclick=()=>{$('results').close();if(this.playlistSummary)this.showPlaylistSummary(this.playlistSummary);};
    $('results').addEventListener('cancel',event=>{event.preventDefault();this.closeReview();});
    $('retryShot').onclick=()=>{const shot=this.report?.shots[this.reviewIndex];if(!shot)return;$('results').close();const {playlistId,playlistIndex,...config}=this.report.config;callbacks.retry(shot,config);};
    $('repeatSession').onclick=()=>{const {playlistId,playlistIndex,...config}=this.report.config;$('results').close();this.applyConfig(config);callbacks.start({...config,rehearsal:false});};
    $('nextSession').onclick=()=>this.closeReview();
    window.addEventListener('resize',()=>{if($('results').open)this.drawReview();});
    $('trainingProfile').onchange=()=>this.applyProfile(true);this.applyProfile(true);this.renderHistory();this.update(null);
  }
  applyProfile(reset=false){
    const advanced=$('trainingProfile').value==='advanced';
    for(const id of ['laneCoach','matchupTelegraphs','yoneTelegraphs','unlimitedMana']){if(reset)$(id).checked=!advanced;$(id).disabled=advanced;}
    $('profileDescription').textContent=advanced?'Sem linhas auxiliares dos projéteis ou destaque do last hit. Adversários observam seu movimento com atraso; mana normal. Pressão muda decisões, não a velocidade dos projéteis.':'Linhas de direção, destaque do last hit e mana livre disponíveis. Use para isolar a leitura de cada situação antes do avançado.';
  }
  updateYoneRating(){const p=yoneRating(+$('difficulty').value);$('yoneRatingName').textContent=p.name;$('yoneASValue').textContent=`${(.625*(1+p.bonusAS)).toFixed(3)} ataques/s · Q: ${p.qCooldown.toFixed(2)} s`;$('yoneCastValue').textContent=`Preparação do Q: ${yoneQCast(p.bonusAS).toFixed(3)} s · bônus AS: +${Math.round(p.bonusAS*100)}%`; }
  selectDrill(id,{autoChampion=true,resetCombat=true}={}){$('spacingSettings').hidden=id!=='spacing';if(autoChampion&&id==='spacing'&&$('championSelect').value!=='caitlyn'){$('championSelect').value='caitlyn';$('championSelect').dispatchEvent(new Event('change'));}if(id==='aim'&&this.drill!=='aim')$('difficulty').value='3';$('aimSettings').hidden=id!=='aim';if(autoChampion&&id==='aim'&&$('championSelect').value!=='xerath'){$('championSelect').value='xerath';$('championSelect').dispatchEvent(new Event('change'));}if(id==='combat'&&resetCombat){$('combatHazards').checked=true;$('combatCircuit').value='on';if(!document.querySelector('[data-skill]:checked'))for(const input of document.querySelectorAll('[data-skill]'))input.checked=true;}if(id==='yone'&&this.drill!=='yone')$('difficulty').value='1';this.drill=id;$('vaultSettings').hidden=id!=='vault';if(autoChampion&&id==='vault'&&$('championSelect').value!=='quinn'){$('championSelect').value='quinn';$('championSelect').dispatchEvent(new Event('change'));}$('laneSettings').hidden=id!=='lane';$('matchupSettings').hidden=!matchupProfiles[id];$('ahriPatternLabel').hidden=id!=='ahri';$('matchupDescription').textContent=id==='ahri'?'Leia Q e Charme em ordens variadas. No avançado, a Ahri encurta o intervalo entre conjurações e muda o ângulo da volta do orbe. Termine a sequência inteira sem tomar nenhuma passagem.':'Locke lança três Qs e se reposiciona. No avançado, segura o terceiro por um intervalo variável: não desvie apenas pelo ritmo. Os projéteis mantêm seus tempos; acertos acumulam lentidão.';if(matchupProfiles[id])$('controls').hidden=false;$('difficultyCaption').textContent=id==='yone'?'Dificuldade do Yone':'Pressão';for(const o of $('difficulty').options)o.textContent=id==='yone'?yoneRating(+o.value).name:({'1':'1 · Leitura','2':'2 · Consistência','3':'3 · Intensidade'})[o.value];this.updateYoneRating();document.body.dataset.drill=id;for(const b of document.querySelectorAll('button[data-drill]')){const selected=b.dataset.drill===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}$('drillTip').textContent=drills[id].tip;$('combatSettings').hidden=!['combat','yone','lane','vault','aim','spacing'].includes(id);$('yoneSettings').hidden=id!=='yone';$('combatCircuitHint').hidden=id==='spacing'||id==='aim'||id==='yone'||id==='lane'||id==='vault';$('combatTargetHint').textContent=id==='spacing'?'Treine a faixa de 500–650 u. Dificuldade altera a reação e os passos do Lucian, preservando alcance, velocidade de movimento e attack speed por nível.':id==='aim'?'Um alvo evasivo com dash e recarga. Acertos medidos por habilidade; tente acertar depois do dash ou durante o controle.':id==='vault'?'Treino isolado: E, mana e vida renovam entre aparições. A LeBlanc usa o W com velocidade fixa; a dificuldade reduz a previsibilidade.':id==='lane'?'O objetivo é punir o farm. Ataques e habilidades também podem atingir os minions vermelhos. Vida e dano das tropas são calibrados para repetições curtas.':id==='yone'?'Yone tem 1800 de vida por investida. Ataque e use suas habilidades nele durante as esquivas. Danos recebidos são calibrados para treino.':$('championSelect').value==='syndra'?'Alvos com 3000 de vida, sem resistências. Treine Q → E, W e o R com esferas acumuladas.': 'Alvos com 600 de vida reaparecem após cair. Dano fixo de treino: 60 por ataque; cada habilidade recebida tira 100 de vida.';if(['combat','yone','lane','vault','aim','spacing'].includes(id))$('controls').hidden=false;}
  config(){return trainingConfig({trainingProfile:$('trainingProfile').value,trainingRuleset:TRAINING_RULESET,champion:$('championSelect').value,spacingSkills:$('spacingSkills').checked,laneCoach:$('laneCoach').checked,laneVersion:2,drill:this.drill,difficulty:+$('difficulty').value,duration:+$('duration').value,speed:+$('speed').value,closeRadius:+$('closeRadius').value,pace:+$('pace').value,seed:crypto.getRandomValues(new Uint32Array(1))[0],skills:[...document.querySelectorAll('[data-skill]:checked')].map(i=>i.dataset.skill),level:+$('level').value,attackSpeed:+$('attackSpeed').value,attackPriority:$('attackPriority').value,bindLeft:$('bindLeft').checked,combatHazards:$('combatHazards').checked,combatCircuit:$('combatCircuit').value,syndraSplinters:Number($('syndraSplinters').value),bonusAD:Math.max(0,Number($('bonusAD').value)||0),critChance:Math.max(0,Math.min(100,Number($('critChance').value)||0)),abilityHaste:Math.max(0,Math.min(200,Number($($('championSelect').value==='xerath'?'xerathHaste':['quinn','caitlyn'].includes($('championSelect').value)?'quinnHaste':'abilityHaste').value)||0)),abilityPower:Math.max(0,Math.min(1000,Number($('abilityPower').value)||0)),unlimitedMana:$('unlimitedMana').checked,matchupPattern:$('matchupPattern').value,matchupTelegraphs:$('matchupTelegraphs').checked,matchupVersion:1,yonePattern:$('yonePattern').value,yoneRatingVersion:4,yoneBonusAS:yoneRating(+$('difficulty').value).bonusAS*100,yoneStacks:+$('yoneStacks').value,yoneTelegraphs:$('yoneTelegraphs').checked});}
  applyConfig(config){$('trainingProfile').value=config.trainingProfile??'assisted';$('championSelect').value=config.champion??'kayle';this.selectDrill(config.drill,{autoChampion:false,resetCombat:false});for(const name of ['difficulty','duration','speed','closeRadius','pace','level','attackSpeed','attackPriority','combatCircuit','abilityPower','abilityHaste','bonusAD','critChance','syndraSplinters','yonePattern','yoneStacks','matchupPattern']){if(!$(name)||config[name]==null)continue;$(name).value=config[name];$(name).dispatchEvent(new Event('input'));}for(const name of ['spacingSkills','laneCoach','bindLeft','combatHazards','unlimitedMana','yoneTelegraphs','matchupTelegraphs'])if(config[name]!=null)$(name).checked=config[name];for(const input of document.querySelectorAll('[data-skill]'))input.checked=config.skills.includes(input.dataset.skill);if(['quinn','caitlyn'].includes(config.champion))$('quinnHaste').value=config.abilityHaste??0;if(config.champion==='xerath')$('xerathHaste').value=config.abilityHaste??0;this.applyProfile();}
  update(session){
    const playlist=this.callbacks.playlistState?.();
    const state=session?.state||'ready',stats=session?.summary();document.body.dataset.training=state;
    $('sessionName').textContent=session?(session.config.rehearsal?'REPETIÇÃO · ': '')+drills[session.config.drill].name.toUpperCase():'SEU PRÓXIMO BLOCO';
    if(session?.config.drill==='combat'&&session.config.combatHazards===false)$('sessionName').textContent='AQUECIMENTO · SEM ATAQUES INIMIGOS';
    $('sessionClock').textContent=duration(session?session.config.duration-session.time:+$('duration').value);
    $('sessionPhase').textContent=({running:'Leia. Clique. Desvie.',paused:'Pausado',draining:'Concluindo habilidades…',finished:'Bloco concluído',ready:'Pronto para começar'})[state];
    $('sessionProgress').max=session?.config.duration||60;$('sessionProgress').value=session?Math.min(session.time,session.config.duration):0;
    $('liveAccuracy').textContent=percentage(stats?.threats!=null?stats.threatAccuracy:stats?.accuracy);$('liveShort').textContent=percentage(stats?.shortClicks);$('liveStreak').textContent=stats?.streak||0;
    const combat=stats?.combat;$('combatHud').hidden=!combat;
    if(combat){$('playerHealth').textContent=`${combat.playerHealth} / ${combat.maxPlayerHealth}`;$('playerHealthBar').value=combat.playerHealth;$('liveDamage').textContent=combat.damage;$('liveAttacks').textContent=combat.hits;$('liveCancels').textContent=combat.cancelled;$('attackRangeText').textContent=`${championRange(session.config.champion,session.config.level)} u · ${session.config.attackSpeed.toFixed(2)} / s`;}
    const lane=stats?.combat?.lane,isLane=this.drill==='lane';
    document.querySelector('.live-stats>div:first-child small').textContent=isLane?'POKES ACERTADOS':'SOB AMEAÇA';
    document.querySelector('.live-stats>div:last-child small').textContent=isLane?'JANELAS PUNIDAS':'SEQUÊNCIA';
    if(isLane){$('liveAccuracy').textContent=percentage(lane?.accuracy);$('liveStreak').textContent=lane?.punished??0;if(lane){$('liveDamage').textContent=lane.enemyDamage;$('liveAttacks').textContent=lane.hits;$('liveCancels').textContent=lane.lastHits;}}
    const combatLabels=document.querySelectorAll('.combat-live small');['DANO NO INIMIGO','POKES','FARM INIMIGO'].forEach((label,i)=>combatLabels[i].textContent=isLane?label:['DANO','ACERTOS','CANCELADOS'][i]);
    if(this.drill==='vault'){const v=stats?.combat?.vault;$('liveAccuracy').textContent=percentage(v?.accuracy);$('liveStreak').textContent=v?.interrupted??0;document.querySelector('.live-stats>div:first-child small').textContent='INTERCEPÇÃO';document.querySelector('.live-stats>div:last-child small').textContent='INTERROMPIDOS';}
    if(this.drill==='aim'){const a=stats?.combat?.aim;$('liveAccuracy').textContent=percentage(a?.accuracy);$('liveStreak').textContent=a?.streak??0;document.querySelector('.live-stats>div:first-child small').textContent='SKILLS ACERTADAS';document.querySelector('.live-stats>div:last-child small').textContent='SEQUÊNCIA';$('sessionPhase').textContent=state==='running'?'Antecipe. Force o dash. Acerte.':$('sessionPhase').textContent;}
    if(this.drill==='spacing'){const s=stats?.combat?.spacing;$('liveAccuracy').textContent=s?.playerHits?percentage(Math.round(100*s.cleanHits/s.playerHits)):'—';$('liveStreak').textContent=s?.cleanStreak??0;document.querySelector('.live-stats>div:first-child small').textContent='SPACING LIMPO';document.querySelector('.live-stats>div:last-child small').textContent='SEQUÊNCIA';if(s){$('liveAttacks').textContent=s.cleanHits;$('liveCancels').textContent=s.retaliationHits;}combatLabels[1].textContent='SEM RESPOSTA';combatLabels[2].textContent='RESPOSTAS';if(state==='running')$('sessionPhase').textContent='Dispare. Recue. Repita.';}
    $('finishSession').hidden=!session||state==='finished';$('finishSession').disabled=state==='draining';
    $('startChallenge').disabled=state==='draining'||!!playlist?.loading||!!playlist?.error||!!window.__trainer?.championLoading;
    $('startChallenge').innerHTML=state==='running'?'Pausar treino <span>Ⅱ</span>':state==='paused'?'Continuar treino <span>▶</span>':'Iniciar treino <span>▶</span>';
    const busy=!!playlist||(session&&state!=='finished');for(const input of document.querySelectorAll('#trainingProfile,#laneCoach,#championSelect,#playAnimation,#stopAnimation,#rotatePreview,#animationClip,#pace,#speed,#closeRadius,#duration,#difficulty,#level,#attackSpeed,#attackPriority,#bindLeft,#combatHazards,#combatCircuit,#bonusAD,#critChance,#spacingSkills,#quinnHaste,#xerathHaste,#abilityPower,#abilityHaste,#syndraSplinters,#unlimitedMana,#yonePattern,#yoneStacks,#yoneTelegraphs,#matchupPattern,#matchupTelegraphs,[data-skill],button[data-drill]'))input.disabled=!!busy;
    $('openPlaylist').disabled=!!busy||!!window.__trainer?.championLoading;
    $('playlistHud').hidden=!playlist;
    if(playlist){$('playlistProgress').textContent=`PLAYLIST · ${Math.min(playlist.index+1,playlist.total)}/${playlist.total} · ${drills[playlist.mode]?.name??'Concluindo'}`;$('playlistNext').textContent=playlist.error?'Falha no carregamento. Tente novamente ou encerre.':playlist.loading?'Carregando próximo bloco…':`Próximo: ${drills[PLAYLIST_MODES[playlist.index+1]]?.name??'resumo da playlist'}`;}
    $('retryPlaylist').hidden=!playlist?.error;
    $('finishSession').textContent=playlist?'Encerrar playlist':'Encerrar e revisar ↗';
    if(playlist){$('finishSession').hidden=false;$('finishSession').disabled=playlist.stopping;}
    if(!busy)this.applyProfile();else if(session?.config.trainingProfile==='advanced')for(const id of ['laneCoach','matchupTelegraphs','yoneTelegraphs','unlimitedMana'])$(id).disabled=true;
  }
  openPlaylist(){
    $('playlistTitle').textContent='Playlist de treino';$('playlistForm').hidden=false;$('playlistSummary').hidden=true;
    $('playlistDuration').value=$('duration').value;$('playlistDifficulty').value=$('difficulty').value;
    $('playlistOrder').replaceChildren(...PLAYLIST_MODES.map(id=>element('li',drills[id].name)));
    this.updatePlaylistEstimate();$('playlistDialog').showModal();
  }
  updatePlaylistEstimate(){const seconds=+$('playlistDuration').value*PLAYLIST_MODES.length;$('playlistEstimate').textContent=`${PLAYLIST_MODES.length} blocos · ${duration(seconds)} de treino ativo, mais a conclusão das habilidades.`;}
  showPlaylistSummary(playlist){
    this.playlistSummary=playlist;
    $('playlistTitle').textContent=playlist.index===playlist.total?'Playlist concluída':'Playlist encerrada';$('playlistForm').hidden=true;$('playlistSummary').hidden=false;
    $('playlistSummaryText').textContent=`${playlist.reports.length}/${playlist.total} blocos registrados · ${playlist.duration} s por bloco · dificuldade ${playlist.difficulty}. Selecione um bloco para revisar.`;
    $('playlistReports').replaceChildren(...playlist.reports.map((report,i)=>{const button=element('button',`${i+1}. ${drills[report.config.drill].name} ↗`);button.append(element('small',`${report.playlistKnockouts??0} ${(report.playlistKnockouts??0)===1?'queda':'quedas'} · ${champions[report.config.champion]?.name??report.config.champion} · ${report.summary.combat?.aim?report.summary.combat.aim.casts+' habilidades lançadas':report.summary.total+' ameaças registradas'}`));button.onclick=()=>{$('playlistDialog').close();this.showReport(report);};return button;}));
    $('playlistDialog').showModal();
  }
  save(report){
    if(report.config.rehearsal||(!report.summary.total&&!report.summary.combat?.started&&!report.summary.combat?.skillCasts&&!report.summary.combat?.lane?.waves&&!report.summary.combat?.vault?.attempts))return;
    this.history.push(report);this.history=this.history.slice(-20);
    try{localStorage.setItem(historyKey,JSON.stringify(this.history));}catch{$('status').textContent='Bloco concluído · navegador sem espaço para salvar o histórico';}
    this.renderHistory();
  }
  renderHistory(){
    const holder=$('history');holder.replaceChildren(element('h3','ÚLTIMOS BLOCOS'));
    if(!this.history.length){holder.append(element('p','Seu primeiro bloco vira a referência. Compare depois com os mesmos ajustes.','history-empty'));return;}
    for(const report of [...this.history].reverse().slice(0,5)){
      const button=element('button','','history-entry'),label=element('div',drills[report.config.drill].name);
      label.append(element('small',`${new Date(report.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} · ${report.config.trainingProfile==='advanced'?'avançado':'assistido'} · pressão ${report.config.difficulty} · ${report.summary.combat?.spacing?.playerHits??report.summary.combat?.aim?.casts??report.summary.combat?.vault?.attempts??report.summary.combat?.lane?.casts??report.summary.total} tentativas`));
      button.append(label,element('strong',report.summary.combat?.spacing?`${report.summary.combat.spacing.cleanHits}/${report.summary.combat.spacing.playerHits} limpos`:report.summary.combat?.aim?`${report.summary.combat.aim.hits}/${report.summary.combat.aim.casts} acertos`:report.summary.combat?.vault?`${report.summary.combat.vault.interrupted}/${report.summary.combat.vault.attempts} interrupções`:report.summary.combat?.lane?`${report.summary.combat.lane.timedHits}/${report.summary.combat.lane.timedCasts} na janela`:report.summary.combat?`${report.summary.combat.damage} dano`:percentage(report.summary.accuracy)));button.onclick=()=>this.showReport(report);holder.append(button);
    }
  }
  showReport(report){
    $('backToPlaylist').hidden=!this.playlistSummary?.reports.includes(report);
    this.report=report;this.reviewIndex=Math.max(0,report.shots.findIndex(s=>s.hit));const stats=report.summary;
    const previous=[...this.history].reverse().find(r=>r!==report&&r.key===settingsKey(report.config)&&r.date<report.date);
    const rate=stats.threats!=null?stats.threatAccuracy:stats.accuracy,delta=previous&&rate!=null?rate-(previous.summary.threatAccuracy??previous.summary.accuracy):null;
    $('resultTitle').textContent=stats.combat?.spacing?'Seu alcance virou vantagem?':stats.combat?.aim?'Seu timing contra a esquiva.':stats.combat?.vault?'O contato decidiu a interrupção.':stats.combat?.lane?'Seu timing contra o farm.':stats.combat?.playerHealth===0?'Vida esgotada. Revise suas janelas.':report.config.rehearsal?'Uma situação, outra decisão.':stats.combat?'Ataque e esquiva, juntos.':'Cada tentativa ensina algo.';
    $('resultContext').textContent=`${champions[report.config.champion??'kayle'].name} · ${drills[report.config.drill].name} · ${report.config.trainingProfile==='advanced'?'avançado':'assistido'} · pressão ${report.config.difficulty} · ${stats.combat?.spacing?.playerHits??stats.combat?.aim?.casts??stats.combat?.vault?.attempts??stats.combat?.lane?.casts??stats.total} tentativas concluídas · ${report.config.speed} u/s`;
    let cards=[
      [percentage(rate),'Esquiva sob ameaça',delta==null?`${stats.threats??stats.total} situações · ${stats.total} lançamentos`:`${delta>=0?'+':''}${delta} pontos vs. último bloco equivalente`],
      [percentage(stats.shortClicks),'Cliques perto do campeão',`Meta ≤ ${report.config.closeRadius} u · ${stats.clicks} cliques`],
      [stats.lateralCommandMs==null?'—':`${Math.round(stats.lateralCommandMs)} ms`,'Comando de saída lateral',`Mediana · ${stats.lateralSamples??0} amostras; não mede latência humana`],
      [String(stats.threats??stats.total),'Amostra sob ameaça',stats.assessmentReady?'20+ situações: compare blocos equivalentes':'Junte 20 situações antes de avaliar consistência'],
    ];
    $('combatResults').hidden=!stats.combat;
    if(stats.combat){const c=stats.combat;
      cards=[[String(c.damage),'Dano de treino',`${c.hits} ataques acertados · ${c.kills} alvos abatidos`],[`${c.dps} / s`,'DPS de treino','Dano dividido pelo tempo ativo do bloco'],[String(c.cancelled),'Ataques cancelados',`${c.started} iniciados · antes do disparo`],[String(c.playerHealth),'Vida restante',`De ${c.maxPlayerHealth} · ${percentage(stats.accuracy)} de esquiva`]];
      $('combatResults').textContent=`${c.apm??0} APM · ${c.changedApm??0} comandos distintos/min · ${c.kiteSteps??0}/${c.kiteOpportunities??0} intervalos com passo ≥60 u · ${c.completedMarks??0} trocas completas / ${c.missedMarks??0} prazos perdidos · E: ${c.eUses??0} usos (${c.resets??0} resets) · W: ${c.wUses??0} usos. ${percentage(stats.shortClicks)} de cliques curtos · ${c.readyIdleTime.toFixed(1)} s com ataque pronto em alcance sem atacar. Esse tempo também pode ter sido usado para desviar.`;
      if(report.config.champion==='syndra')$('combatResults').textContent=`${c.apm??0} APM · ${c.skillCasts??0} conjurações · ${c.stuns??0} atordoamentos · ${c.spheresCreated??0} esferas criadas · ${c.spheresThrown??0} arremessadas · ${c.rSpheres??0} esferas no R · ${c.executions??0} execuções · ${c.splinters??0}/120 fragmentos.`;
      if(report.config.champion==='leblanc')$('combatResults').textContent=`${c.apm??0} APM · ${c.skillCasts??0} habilidades conjuradas · ${c.markDetonations??0} marcas detonadas · ${c.roots??0} enraizamentos · ${c.returns??0} retornos. ${c.kiteSteps??0}/${c.kiteOpportunities??0} intervalos com passo ≥60 u. ${report.config.abilityPower??0} AP · ${report.config.unlimitedMana===false?'mana normal':'mana livre de treino'}.`;
      if(report.config.champion==='quinn')$('combatResults').textContent=`${c.harrierProcs??0} marcas consumidas · ${c.vaults??0} Saltos · ${c.skystrikes??0} Ataques do Céu · ${c.skillCasts??0} habilidades.`;
      if(report.config.champion==='caitlyn')$('combatResults').textContent=`${c.headshots??0} Headshots · ${c.trapHeadshots??0} de armadilha · ${c.netHeadshots??0} de rede · ${c.trapsTriggered??0} armadilhas ativadas · ${c.skillCasts??0} habilidades · ${c.rIntercepted??0} tiros do R interceptados.`;
      if(c.advancedCircuit)$('combatResults').textContent+=` Circuito avançado: passos ≥${c.stepRequired} u · ${c.stationaryReleases} disparos sem reposicionar · ${c.offTargetReleases} disparos no alvo errado.`;
      if(c.lane){const l=c.lane;cards=[[`${l.timedHits}/${l.timedCasts}`,'Pokes na janela','Conjuração durante a preparação do last hit'],[`${l.offWindowHits}/${l.casts-l.timedCasts}`,'Pokes fora da janela','Compare com os acertos durante o farm'],[`${l.punished}/${l.windows}`,'Janelas aproveitadas','Preparações de farm punidas ao menos uma vez'],[`${l.farmLastHits??0}/${(l.farmLastHits??0)+(l.farmMissed??0)}`,'Seu farm',`${l.siegeSecured??0} catapultas garantidas · ${l.enemyDamage} dano de poke`]];$('combatResults').textContent=`${c.apm??0} APM · ${l.hits}/${l.casts} pokes acertados. Observe a vida do minion e o início da animação de ataque. ${l.lastHits} last hits inimigos · ${l.missed} minions perdidos · ${l.waves} ondas · ${l.tradeHits??0} respostas inimigas acertadas (${l.tradeDamage??0} dano) · ${l.counterTrades??0} contra-ataques após habilidade gasta fora da janela.`;}
      if(c.vault){const v=c.vault;cards=[[`${v.interrupted}/${v.attempts}`,'W interrompidos',`${percentage(v.accuracy)} de sucesso por contato durante o avanço`],[`${v.early} / ${v.late}`,'Cedo / tarde','E antes do avanço ou depois da aterrissagem'],[v.reactionMs==null?'—':`${v.reactionMs} ms`,'Comando E após início do W',`Mediana das ${v.reactionSamples} interrupções reativas`],[String(v.wHits),'W que acertaram','Sair da área evita dano, mas não pontua interrupção']];$('combatResults').textContent=`${v.missed} avanços sem intercepção · ${v.held??0}/${v.patienceTrials??0} aproximações sem W respeitadas · ${v.falseStarts??0} E precipitados · E, mana e vida restaurados a cada aparição. Contato mediano: ${v.contactMs??'—'} ms após o início do W. Pressionar E é diferente de já ter alcançado o alvo.`;}
      if(c.spacing){const s=c.spacing;cards=[[`${s.cleanHits}/${s.playerHits}`,'Ataques de spacing limpo','Na faixa de vantagem, sem controle ou resposta'],[String(s.retaliationHits),'Respostas recebidas','Recuar depois do disparo inimigo não apaga a bala'],[percentage(s.bandPercent),'Tempo entre 500 e 650 u','Distância entre as bordas dos campeões'],[String(s.cancelled),'Autoattacks cancelados',`${s.bestStreak} ataques limpos na melhor sequência`]];$('combatResults').textContent=`${s.playerReleases} disparos · ${s.trades} trocas recebidas · ${s.deniedAttacks} preparações inimigas interrompidas · Lucian: ${s.enemyAttackSpeed.toFixed(3)} ataques/s. ${report.config.spacingSkills?'Kit habilitado; acertos em alvo controlado não pontuam spacing.':'Somente autoattacks.'}`;}
      if(c.aim){const a=c.aim;cards=[[percentage(a.accuracy),'Precisão das habilidades',`${a.hits}/${a.casts} conjurações acertaram`],[String(a.landingHits),'Punições na aterrissagem','Acertos logo depois do dash'],[String(a.controlledHits),'Acertos durante controle','Aproveite o atordoamento do E'],[String(a.wCenters),'Centros do W',`${a.bestStreak} acertos consecutivos no melhor trecho`]];$('combatResults').textContent=Object.entries(a.byAbility).map(([key,v])=>`${key}: ${v.hits}/${v.casts} (${percentage(v.accuracy)})`).join(' · ')+` · ${a.dashes} dashes inimigos · reação ${a.reactionMs} ms · dash a cada ${a.dashCooldown} s quando necessário.`;}
      if(c.yone)$('combatResults').textContent+=` Yone: ${c.yone.cleanRounds}/${c.yone.rounds} investidas limpas · E repetiu ${c.yone.repeatDamage} de dano.`;
      $('resultContext').textContent+=` · nível ${report.config.level} · ${report.config.attackSpeed.toFixed(2)} ataques/s`;
    }
    if(stats.matchup){const m=stats.matchup;cards[1]=[`${m.cleanRounds}/${m.completedRounds}`,'Sequências totalmente limpas','Só conta depois que todas as habilidades terminarem'];const id=m.champion==='ahri'?'ahriQReturn':'lockeQ3',q=m.results[id];cards[2]=[q?`${q.total-q.hits}/${q.total}`:'—',m.champion==='ahri'?'Voltas do Q evitadas':'Terceiros Q evitados','Leia a segunda decisão da sequência'];}
    $('resultMetrics').replaceChildren(...cards.map(([value,label,detail])=>{const node=element('div','','result-metric');node.append(element('b',value),element('span',label),element('small',detail));return node;}));
    $('recommendation').textContent=stats.combat?.spacing?'O clique de recuo deve vir depois da sua bala sair e antes que Lucian complete o ataque. Aproveite o intervalo em que ele está em recarga para voltar à faixa; não transforme alcance extra em perseguição.':stats.combat?.aim?'Observe a recarga do dash. Use E para limitar a esquiva e mire o centro do W; depois aproveite a lentidão para o Q ou R. Compare a precisão por habilidade entre blocos da mesma dificuldade.':stats.combat?.vault?'Leia o avanço real: no avançado também há aproximações sem W. Guardar o E nessas ocasiões faz parte do treino; E tardio não desfaz dano já recebido.':stats.combat?.lane?'Divida a atenção entre seu last hit e a preparação do ataque inimigo. Poke na janela, recue antes da resposta e evite perder a catapulta enquanto persegue dano.':recommendation(stats);
    $('skillBreakdown').replaceChildren(...stats.bySkill.map(s=>{const skill=dodgeSkills[s.id],node=element('div','','skill-result');node.append(element('span',`${skill.champion} ${skill.key}`),element('b',s.total?`${s.total-s.hits}/${s.total} · ${Math.round(100*(s.total-s.hits)/s.total)}%`:'Sem tentativas'));return node;}));
    $('shotPicker').replaceChildren(...report.shots.map((s,index)=>{const option=element('option',`${index+1}. ${s.name} · ${s.hit?'atingida':'desviada'}`);option.value=index;return option;}));
    $('shotPicker').value=this.reviewIndex;$('reviewTime').value=1000;$('retryShot').disabled=!report.shots.length;
    $('repeatSession').hidden=!!report.config.rehearsal;
    document.querySelector('.review-layout').hidden=!report.shots.length;
    if(!$('results').open)$('results').showModal();this.drawReview();
  }
  closeReview(){$('results').close();this.callbacks.reset();}
  drawReview(){
    const canvas=$('reviewCanvas'),ctx=canvas.getContext('2d'),shot=this.report?.shots[this.reviewIndex];
    canvas.width=Math.round(canvas.clientWidth);canvas.height=Math.round(canvas.clientHeight);
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c1c16';ctx.fillRect(0,0,w,h);
    if(!shot){$('shotFeedback').textContent='Conclua pelo menos uma tentativa para revisar.';return;}
    const total=shot.endedAt-shot.startedAt,t=total*+$('reviewTime').value/1000;
    $('reviewTimeLabel').textContent=`${t.toFixed(2)} / ${total.toFixed(2)} s`;
    $('shotFeedback').textContent=shot.feedback;
    const circle=shot.kind==='circle'||shot.parameters?.kind==='circle';
    const points=[shot.origin,shot.start,shot.end,...shot.path,...(circle?[{x:shot.endpoint.x-shot.radius,z:shot.endpoint.z-shot.radius},{x:shot.endpoint.x+shot.radius,z:shot.endpoint.z+shot.radius}]:[])],xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs)-180,maxX=Math.max(...xs)+180,minZ=Math.min(...zs)-180,maxZ=Math.max(...zs)+180;
    const scale=Math.min((w-50)/(maxX-minX),(h-40)/(maxZ-minZ));
    const project=p=>({x:w/2+(p.x-(minX+maxX)/2)*scale,y:h/2+(p.z-(minZ+maxZ)/2)*scale});
    const line=(a,b,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
    for(let x=0;x<w;x+=40)line({x,y:0},{x,y:h},'#c5e5be08');for(let y=0;y<h;y+=40)line({x:0,y},{x:w,y},'#c5e5be08');
    const a=project(shot.origin),b=project(shot.endpoint);
    const shotSkill={...dodgeSkills[shot.skill],...shot.parameters,speed:shot.parameters?.speed??dodgeSkills[shot.skill].speed};
    if(circle){ctx.beginPath();ctx.arc(b.x,b.y,(shot.radius-65)*scale,0,Math.PI*2);ctx.fillStyle=t<shot.warning?'#d9b97d30':'#ec9d7e66';ctx.fill();ctx.strokeStyle='#f5b276';ctx.stroke();}
    else if(shotSkill.kind==='cone'){const angle=Math.atan2(shot.direction.z,shot.direction.x);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.arc(a.x,a.y,shotSkill.range*scale,angle-40*Math.PI/180,angle+40*Math.PI/180);ctx.closePath();ctx.fillStyle='#ec9d7e27';ctx.fill();}
    else line(a,b,t<shot.warning?'#d9b97d18':'#ec9d7e27',Math.max(1,(shot.radius-65)*2*scale));
    ctx.setLineDash([5,5]);line(a,b,'#d99d7180');ctx.setLineDash([]);
    const shown=shot.path.filter(p=>p.t<=t);if(!shown.length)shown.push(shot.path[0]);
    for(let i=1;i<shown.length;i++){ctx.setLineDash(shown[i].blink?[3,5]:[]);line(project(shown[i-1]),project(shown[i]),shown[i].blink?'#ffe2a0':'#b9e2ab',2.5);}ctx.setLineDash([]);
    for(const command of shot.commands.filter(c=>c.t<=t)){const p=project(command.to),from=project(command.from);ctx.setLineDash([2,5]);line(from,p,'#aed2bf44');ctx.setLineDash([]);line({x:p.x-3,y:p.y-3},{x:p.x+3,y:p.y+3},'#dfd1a3');line({x:p.x-3,y:p.y+3},{x:p.x+3,y:p.y-3},'#dfd1a3');}
    const dot=(p,r,fill,stroke)=>{ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();};
    dot(project(shot.start),4,'#8baca0','#8baca0');
    const player=project(shown.at(-1));dot(player,65*scale,'#b8e2ab20',shot.hit&&t>=total-.01?'#ff9e8b':'#b8e2ab');dot(player,3,'#ecf1d7','#ecf1d7');
    const skill=shotSkill;
    if(shot.missilePath?.length&&t>=shot.warning){const history=shot.missilePath.filter(p=>p.t<=t);for(let i=1;i<history.length;i++)line(project(history[i-1]),project(history[i]),'#e9bd85',2);if(history.length)dot(project(history.at(-1)),Math.max(3,(shot.radius-65)*scale),'#f2b481aa','#f6d8b9');}
    else if(skill.kind==='missile'&&t>=shot.warning){const distance=Math.min(skill.range,skill.speed*(t-shot.warning));dot(project({x:shot.origin.x+shot.direction.x*distance,z:shot.origin.z+shot.direction.z*distance}),Math.max(3,(shot.radius-65)*scale),'#f2b481aa','#f6d8b9');}
    dot(a,5,'#ddae77','#ddae77');ctx.font='11px sans-serif';ctx.fillStyle='#9cb2a0';ctx.fillText('Vista superior · posições em unidades do treino',14,22);ctx.fillStyle='#d4c7a2';ctx.fillText(`${shot.name} · ${shot.aimMode==='return'?'retorno à Ahri':shot.aimMode==='lead'?'mira antecipada':'mira na posição'}`,14,h-15);
  }
}
