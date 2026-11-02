import './asset-loading.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import './style.css';
import {advance,effectiveSpeed} from './simulation.js';
import {dodgeSkills,skillshotHitsPoint,pointSegmentDistanceXZ,castEndpoint,hazardDistance,movingPointDistance} from './dodge-simulation.js';
import {dodgeWavePlan,DodgeDeck} from './dodge-patterns.js';
import {DodgeFlash,FLASH_MODES} from './dodge-flash.js';
import {TrainingSession,drills,shuffled} from './training.js';
import {trainingConfig,MovementObserver,engagementPlan} from './training-rules.js';
import {TrainingUI} from './training-ui.js';
import {TrainingPlaylist} from './playlist.js';
import {Combat} from './combat.js';
import {QuinnCombat} from './quinn-combat.js';
import {VaultEncounter} from './vault-encounter.js';
import {VaultView} from './vault-view.js';
import {SyndraCombat} from './syndra-combat.js';
import {LaneEncounter,laneTargets} from './lane-encounter.js';
import {LaneView} from './lane-view.js';
import {YoneEncounter,yoneSkills} from './yone-encounter.js';
import {yoneRating} from './yone-data.js';
import {matchupProfiles,matchupSkills} from './matchup-data.js';
import {MatchupEncounter} from './matchup-encounter.js';
import {MatchupView} from './matchup-view.js';
import {YoneView} from './yone-view.js';
import {YoneEffects} from './yone-effects.js';
import {LeBlancCombat} from './leblanc-combat.js';
import {CombatView} from './combat-view.js';
import {loadPlayerModel} from './player-models.js';
import {champions,championRange,leblancClipLabels} from './champions.js';

const $=id=>document.getElementById(id);
let movementObserver=new MovementObserver();
const renderer=new THREE.WebGLRenderer({canvas:$('arena'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#142522');
scene.fog=new THREE.FogExp2('#142522',.00015);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,10,16000);
const focus=new THREE.Vector3(),position=new THREE.Vector3(),target=new THREE.Vector3();
const clock=new THREE.Clock(),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let speed=335,height=1510,angle=56,locked=false,pointerInside=false,moving=false,model,playerAnimator,clips=[];
const actor=new THREE.Group();scene.add(actor);
const ownGameplayRadius=65;
const enemies=new Map(),warnings=[],projectiles=[],effects=[],textures=new Map();
let challengeActive=false,nextAttack=0,lastSkillId='',elapsed=0,dodged=0,hits=0,casts=0;
let waveRemaining=0,waveCooldown=0,waveNumber=0,aimLeadNext=false,lastAimMode='current';
const waveEnemies=[],playerVelocity=new THREE.Vector3();
let dodgeDeck=new DodgeDeck(()=>random()),wavePlan=null,waveCastIndex=0,lastWaveCastAt=null;
let session=null,ui,hudUpdate=0,playlist=null;
let dodgeFlash=new DodgeFlash();
let combat=null,attackArmed=false;
let vault=null;const vaultView=new VaultView(scene);
let lane=null;const laneView=new LaneView(scene);
const combatView=new CombatView(scene);
const yoneView=new YoneView(scene),yoneEffects=new YoneEffects(scene);
let yone=null;const yoneShots=new Map();
let matchup=null;const matchupShots=new Map(),matchupView=new MatchupView(scene);
const previousPlayerPosition=new THREE.Vector3();
const random=()=>session?.random()??Math.random();
const enemyMoveSpeeds={xerath:340,nautilus:325,thresh:330,lux:330,ezreal:325};

const ambient=new THREE.HemisphereLight('#e8ede2','#40534a',2.2);scene.add(ambient);
const sun=new THREE.DirectionalLight('#fff0c9',2.1);sun.position.set(-1000,2400,1200);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-2200,right:2200,top:2200,bottom:-2200,near:1,far:6000});sun.shadow.bias=-.0005;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000),new THREE.MeshStandardMaterial({color:'#344b3d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(16000,80,'#69785a','#415648');grid.position.y=.2;grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
const pad=new THREE.Mesh(new THREE.CircleGeometry(1050,96),new THREE.MeshStandardMaterial({color:'#3d5144',roughness:1}));pad.rotation.x=-Math.PI/2;pad.position.y=.3;pad.receiveShadow=true;scene.add(pad);

function ring(radius,color,opacity=1){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-1.5,radius+1.5,100),new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.y=1;return mesh;}
scene.add(ring(1050,'#899174',.45));
scene.add(ring(1025,'#899174',.15));
for(let i=0;i<12;i++){const a=i*Math.PI/6,mark=new THREE.Mesh(new THREE.BoxGeometry(3,1,i%3===0?38:15),new THREE.MeshBasicMaterial({color:'#929579'}));mark.position.set(Math.sin(a)*1036,1,Math.cos(a)*1036);mark.rotation.y=a;scene.add(mark);}

// Gameplay collision stays numerical; the player should not see a debug hitbox.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const shadowContext=shadowCanvas.getContext('2d'),shadowGradient=shadowContext.createRadialGradient(64,64,8,64,64,62);shadowGradient.addColorStop(0,'rgba(5,14,10,.5)');shadowGradient.addColorStop(.48,'rgba(5,14,10,.2)');shadowGradient.addColorStop(1,'rgba(5,14,10,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,128,128);
const shadowTexture=new THREE.CanvasTexture(shadowCanvas),shadow=new THREE.Mesh(new THREE.CircleGeometry(78,40),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
shadow.rotation.x=-Math.PI/2;shadow.position.y=1;actor.add(shadow);

let championId='kayle',championLoading=true,championRequest=0;
async function selectChampion(id,{defaults=true}={}){
  if(!champions[id])id='kayle';
  const request=++championRequest;championLoading=true;ui?.update(session);
  $('status').textContent='Carregando '+champions[id].name+'…';
  try{
    const loaded=await loadPlayerModel(id);if(request!==championRequest)return false;
    resetChallenge();if(model)actor.remove(model);
    championId=id;model=loaded.model;clips=loaded.clips;playerAnimator=loaded.animator;playerAnimator.reset();
    model.rotation.y=0;actor.add(model);$('championSelect').value=id;
    $('heroName').textContent=champions[id].name;document.querySelector('.sigil').textContent=champions[id].name[0];$('champion-label').textContent=champions[id].name;document.body.dataset.champion=id;
    $('levelCaption').textContent='Nível de '+champions[id].name;
    if(id==='syndra'||id==='quinn'){const selected=$('level').value;$('level').replaceChildren(...Array.from({length:18},(_,i)=>{const option=document.createElement('option');option.value=i+1;return option;}));$('level').value=selected;}
    for(const option of $('level').options){const level=+option.value;option.textContent=level+' · '+(id==='kayle'&&level<6?'corpo a corpo':'à distância')+' · '+championRange(id,level)+' u';}
    const mage=id!=='kayle';
    $('quinnSettings').hidden=id!=='quinn';$('quinnInfo').hidden=id!=='quinn';
    if(id==='quinn')await combatView.quinnEffects.load();
    $('kayleAbilityHints').hidden=id!=='kayle';$('leblancInfo').hidden=id!=='leblanc';$('syndraInfo').hidden=id!=='syndra';$('syndraSettings').hidden=id!=='syndra';$('animationLibrary').hidden=!mage;
    document.querySelector('.combat-abilities').hidden=id!=='kayle';
    $('leblancAbilities').hidden=!mage;$('leblancSettings').hidden=!mage;
    const labels=id==='quinn'?['Investida Anuviante','Sentidos Apurados','Salto','Retaguarda do Inimigo']:id==='syndra'?['Esfera Negra','Determinação','Dispersar','Poder Irrestrito']:['Sigilo','Distorção','Correntes','Mímica'];
    ['Q','W','E','R'].forEach((key,i)=>$(`lbCast${key}`).querySelector('strong').textContent=labels[i]);
    if(mage){
      $('animationTitle').textContent='ANIMAÇÕES ORIGINAIS · '+champions[id].name.toUpperCase();
      $('animationDescription').textContent=clips.length+' clipes originais da skin base. Visualização antes do bloco, sem dano ou deslocamento de habilidades.';
      $('animationClip').replaceChildren(...clips.map(c=>{const option=document.createElement('option');option.value=c.name;option.textContent=(leblancClipLabels[c.name]||c.name)+' · '+c.name;return option;}));$('animationClip').value=id==='quinn'?'quinn_idle1':id==='syndra'?'syndra_idle1':'idle1';
    }
    combatView.syndraEffects.setOrbAnchors?.(id==='syndra'?[1,2,3].map(n=>model.getObjectByName('Buffbone_CSTM_Orb_'+n)):[]);
    if(defaults&&id==='quinn'){if(ui.drill!=='vault')ui.selectDrill('combat');$('combatCircuit').value='off';$('combatHazards').checked=false;const lv=+$('level').value,growth=.7025*(lv-1)+.0175*(lv*lv-1);$('attackSpeed').value=(.668*(1+.031*growth)).toFixed(2);$('attackSpeed').dispatchEvent(new Event('input'));}
    if(defaults&&id==='syndra'){ui.selectDrill('combat');$('combatCircuit').value='off';$('combatHazards').checked=false;$('controls').hidden=false;const lv=+$('level').value,growth=.7025*(lv-1)+.0175*(lv*lv-1);$('attackSpeed').value=(.658+.625*.02*growth).toFixed(2);$('attackSpeed').dispatchEvent(new Event('input'));}
    if(defaults){speed=champions[id].moveSpeed;$('speed').value=speed;$('speedValue').textContent=speed+' u/s';}
    setPlayerAnimation(false);window.__modelLoaded=true;$('status').textContent='● '+champions[id].name+' pronta · modelos e animações originais';
    return true;
  }catch(error){$('status').textContent='Falha ao carregar '+champions[id].name+' · tente selecionar novamente';$('championSelect').value=championId;console.error(error);return false;}
  finally{if(request===championRequest){championLoading=false;ui?.update(session);}}
}

function setPlayerAnimation(walk,dt=0){playerAnimator?.update(dt,{time:combat?.time??elapsed,moving:walk,level:combat?.level??1,speed:speed*(combat?.speedMultiplier??1),windup:combat?.windup,attackUntil:combat?.animationUntil??0,holding:!!combat?.holding,valor:!!combat?.valor,dashPhase:combat?.dash?.phase});}
function playPlayerAttack(event){
  if(!playerAnimator)return;const victim=combat.target(event.targetId),bearing=Math.atan2(victim.position.x-position.x,victim.position.z-position.z)-model.rotation.y;
  playerAnimator.attack(event,{time:combat.time,attackSpeed:combat.attackSpeed,angle:Math.atan2(Math.sin(bearing),Math.cos(bearing))});
}

const textureLoader=new THREE.TextureLoader();
function loadTexture(name){if(!textures.has(name)){const texture=textureLoader.load(`/assets/dodge/${name}`);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;textures.set(name,texture);}return textures.get(name);}
const objLoader=new OBJLoader();
const casterInfo={
  xerath:{label:'Xerath',height:190,texture:'xerath.png',model:'/assets/dodge/models/xerath_animated.glb',castModel:'/assets/dodge/models/xerath_cast.glb',castClip:'xerath_spell1',x:300,z:-650,skill:'xerathQ'},
  nautilus:{label:'Nautilus',height:270,texture:'nautilus_base.png',model:'/assets/dodge/models/nautilus_animated.glb',castModel:'/assets/dodge/models/nautilus_cast.glb',castClip:'nautilus_spell1',x:850,z:-150,skill:'nautilusQ'},
  thresh:{label:'Thresh',height:260,texture:'thresh.png',model:'/assets/dodge/models/thresh_animated.glb',castModel:'/assets/dodge/models/thresh_cast.glb',castClip:'thresh_spell1_in',x:0,z:450,skill:'threshQ'},
  lux:{label:'Lux',height:185,texture:'lux.png',model:'/assets/dodge/models/lux_animated.glb',castModel:'/assets/dodge/models/lux_r_cast.glb',castClip:'lux_spell4',x:-450,z:300,skill:'luxR'},
  ezreal:{label:'Ezreal',height:185,texture:'ezreal.png',model:'/assets/dodge/models/ezreal_animated.glb',castModel:'/assets/dodge/models/ezreal_cast.glb',castClip:'ezreal_spell1',x:-600,z:-150,skill:'ezrealQ'}
};
Object.assign(casterInfo.xerath,{skills:['xerathQ','xerathE'],extraCastModels:['/assets/dodge/models/xerath_e_cast.glb'],castClips:{xerathQ:'xerath_spell1',xerathE:'xerath_spell3'}});
Object.assign(casterInfo.lux,{skills:['luxR','luxQ'],extraCastModels:['/assets/dodge/models/lux_q_cast.glb'],castClips:{luxR:'lux_spell4',luxQ:'lux_spell1'}});
Object.assign(casterInfo,{
  morgana:{label:'Morgana',height:200,texture:'morgana.png',model:'/assets/dodge/models/morgana_animated.glb',castClip:'morgana_spell1_0',skill:'morganaQ',x:-500,z:-450},
  blitzcrank:{label:'Blitzcrank',height:170,texture:'blitzcrank.png',model:'/assets/dodge/models/blitzcrank_animated.glb',castClip:'blitzcrank_spell1',skill:'blitzcrankQ',x:600,z:350},
  brand:{label:'Brand',height:220,texture:'brand.png',model:'/assets/dodge/models/brand_animated.glb',castClip:'brand_spell1',skill:'brandQ',skills:['brandQ','brandW'],castClips:{brandQ:'brand_spell1',brandW:'brand_spell2'},x:500,z:-500},
});
Object.assign(enemyMoveSpeeds,{morgana:335,blitzcrank:325,brand:340});
const enemyLabels=[];

function texturedModel(root,textureName){
  const map=loadTexture(textureName);
  root.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){material.map=map;material.color?.set(0xffffff);material.side=THREE.DoubleSide;material.roughness=.86;material.metalness=.04;material.alphaTest=.035;material.needsUpdate=true;}o.material=Array.isArray(o.material)?materials:materials[0];o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;});
}
function normalizeModel(root,targetHeight){
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  if(size.y>0){root.scale.setScalar(targetHeight/size.y);root.position.x=-(bounds.min.x+bounds.max.x)/2*root.scale.x;root.position.z=-(bounds.min.z+bounds.max.z)/2*root.scale.z;root.position.y=-bounds.min.y*root.scale.y;}
  root.updateMatrixWorld(true);
}
function countSkinnedMeshes(root){let count=0;root?.traverse(object=>{if(object.isSkinnedMesh)count++;});return count;}
async function loadCasterModel(info){
  const [gltf,...castGltfs]=await Promise.all([info.model,...(info.castModel?[info.castModel]:[]),...(info.extraCastModels??[])].map(url=>new GLTFLoader().loadAsync(url))),root=gltf.scene;
  texturedModel(root,info.texture);normalizeModel(root,info.height);
  // The exported Morgana vertex-color channel masks the body in the browser
  // color pass. Her original diffuse atlas supplies the visible surface color.
  if(info.id==='morgana')root.traverse(o=>{if(o.isMesh){o.material.vertexColors=false;o.material.needsUpdate=true;}});
  const idleClip=gltf.animations.find(clip=>clip.name.toLowerCase().includes('idle'));
  const clips=[...new Map([gltf,...castGltfs].flatMap(g=>g.animations).map(c=>[c.name,c])).values()].map(c=>{const names=new Set(c.tracks.map(t=>t.name));return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...(idleClip?.tracks??[]).filter(t=>!names.has(t.name))]);});
  const mixer=new THREE.AnimationMixer(root),actions=clips.map(clip=>mixer.clipAction(clip));
  const runClip=gltf.animations.find(clip=>clip.name.toLowerCase().includes('run'));
  const castClip=clips.find(clip=>clip.name.toLowerCase()===info.castClip);
  const idleAction=idleClip?actions.find(a=>a.getClip().name===idleClip.name):actions[0];
  const runAction=runClip?actions.find(a=>a.getClip().name===runClip.name):null;
  const castAction=castClip?mixer.clipAction(castClip):null;
  const castVariants=new Map(Object.entries(info.castClips??{[info.skill]:info.castClip}).map(([id,name])=>{const clip=clips.find(c=>c.name===name);if(!clip)throw new Error(`Missing ${info.label} ${id} animation ${name}`);const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;return [id,{clip,action}];}));
  if(idleAction){idleAction.setLoop(THREE.LoopRepeat,Infinity).timeScale=.94+Math.random()*.12;idleAction.play();}
  if(runAction)runAction.setLoop(THREE.LoopRepeat,Infinity);
  if(castAction){castAction.setLoop(THREE.LoopOnce,1);castAction.clampWhenFinished=true;}
  const enemy={model:root,mixer,actions,action:idleAction,idleAction,runAction,castAction,castClip,castVariants,castDuration:castClip?.duration||.65,castRemaining:0,targetYaw:0,moving:false,active:false,moveSpeed:enemyMoveSpeeds[info.id]||330};
  return enemy;
}
function selectEnemySkill(enemy,skill){enemy.skill=skill;const variant=enemy.castVariants?.get(skill.id);if(variant){enemy.castAction=variant.action;enemy.castClip=variant.clip;enemy.castDuration=variant.clip.duration;}}
function playEnemyCast(enemy){
  if(!enemy.castAction||!enemy.idleAction)return;
  enemy.castRemaining=Math.max(enemy.castDuration,enemy.skill.warning);
  const previous=enemy.action||enemy.idleAction;
  enemy.castAction.reset().setEffectiveWeight(1);
  if(previous===enemy.castAction)enemy.castAction.fadeIn(.28).play();
  else enemy.castAction.crossFadeFrom(previous,.28,false).play();
  enemy.action=enemy.castAction;
}
function updateEnemyCast(enemy,dt){
  if(enemy.castRemaining<=0)return;
  enemy.castRemaining-=dt;
  if(enemy.castRemaining<=0){
    // Fade-out can disable an action in Three.js. Reset it before replaying or
    // it may remain disabled at weight zero, leaving the rig in its last pose.
    if(!(enemy.active&&challengeActive))setEnemyLocomotion(enemy);
  }
}
function setEnemyLocomotion(enemy){
  if(!enemy.model||enemy.castRemaining>0)return;
  const next=enemy.moving&&enemy.runAction?enemy.runAction:enemy.idleAction;
  if(!next||enemy.action===next)return;
  next.reset().setLoop(THREE.LoopRepeat,Infinity);next.timeScale=enemy.moving?1:.94+Math.random()*.12;
  next.crossFadeFrom(enemy.action||enemy.idleAction,.18,false).play();enemy.action=next;
}
function updateEnemyPose(enemy,dt){
  enemy.mixer?.update(dt);
  updateEnemyCast(enemy,dt);
  if(!enemy.model)return;
  if(enemy.dismissWhenCastComplete&&enemy.castRemaining<=0){enemy.dismissWhenCastComplete=false;enemy.active=false;enemy.moving=false;enemy.group.visible=false;}
  if(enemy.active&&challengeActive&&!enemy.hasCast&&enemy.castRemaining<=0){
    const dx=position.x-enemy.group.position.x,dz=position.z-enemy.group.position.z,distance=Math.hypot(dx,dz),stopDistance=enemy.engagement?.distance??520;
    enemy.moving=distance>stopDistance;
    if(enemy.moving){const step=Math.min(distance-stopDistance,enemy.moveSpeed*dt),side=enemy.engagement?.side??0,angle=Math.atan2(dx,dz)+side*.23;enemy.group.position.x+=Math.sin(angle)*step;enemy.group.position.z+=Math.cos(angle)*step;enemy.targetYaw=Math.atan2(dx,dz);}
    setEnemyLocomotion(enemy);
  }else if(!enemy.active&&enemy.moving){enemy.moving=false;setEnemyLocomotion(enemy);}
  const delta=Math.atan2(Math.sin(enemy.targetYaw-enemy.group.rotation.y),Math.cos(enemy.targetYaw-enemy.group.rotation.y));
  const response=20+14*Math.min(1,Math.abs(delta)/Math.PI);enemy.group.rotation.y+=delta*(1-Math.exp(-response*dt));
}
for(const [id,info] of Object.entries(casterInfo)){
  const group=new THREE.Group();group.position.set(info.x,0,info.z);scene.add(group);
  const enemy={id,name:info.label,group,initialPosition:new THREE.Vector3(info.x,0,info.z),model:null,mixer:null,actions:[],action:null,idleTimer:0,targetYaw:Math.atan2(-group.position.x,-group.position.z),skill:dodgeSkills[info.skill],labelHeight:info.height+28,moveSpeed:enemyMoveSpeeds[id]||330,moving:false,active:false};enemies.set(id,enemy);group.visible=false;
  enemy.skills=info.skills??[info.skill];
  loadCasterModel({...info,id}).then(loaded=>{Object.assign(enemy,loaded,{group});group.add(enemy.model);if([...enemies.values()].every(item=>item.model))$('status').textContent='● Arena pronta · campeões animados do jogo';}).catch(error=>console.error(`Failed to load ${info.label}`,error));
  const label=document.createElement('div');label.className='training-target-label';label.textContent=`${info.label} · ${dodgeSkills[info.skill].key}`;document.body.appendChild(label);enemyLabels.push({enemy,label});
}
const qLoader=new OBJLoader();let nautilusAnchor=null;
let blitzcrankFist=null;
qLoader.load('/assets/dodge/models/blitzcrank_fist.obj',o=>{texturedModel(o,'blitzcrank_base_z_fist.png');o.scale.setScalar(1.3);blitzcrankFist=o;},undefined,error=>console.error('Blitzcrank fist unavailable',error));
qLoader.load('/assets/dodge/models/nautilus_anchor.obj',o=>{
  texturedModel(o,'nautilus_base.png');
  // Bake a centered pivot into the mesh before resizing. Changing only the
  // root scale after normalizeModel left its translation at the old scale.
  const bounds=new THREE.Box3().setFromObject(o),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  o.traverse(child=>{if(child.isMesh){child.geometry.translate(-center.x,-center.y,-center.z);child.geometry.scale(150/size.x,115/size.y,2.6*115/size.y);}});
  nautilusAnchor=o;
},undefined,error=>console.warn('Nautilus anchor visual unavailable',error));

function makeGroundLane(start,direction,length,width,color,opacity=.42,textureName=null){
  const group=new THREE.Group();group.position.set(start.x,.8,start.z);group.rotation.y=Math.atan2(-direction.x,-direction.z);scene.add(group);
  const material=textureName?new THREE.MeshBasicMaterial({map:loadTexture(textureName),color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}):new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
  const geometry=new THREE.PlaneGeometry(width,length);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-length/2);
  group.add(new THREE.Mesh(geometry,material));return group;
}
function makeBeam(start,direction,length,width,color,textureName){
  const group=new THREE.Group(),yaw=Math.atan2(-direction.z,direction.x),mid=start.clone().add(direction.clone().multiplyScalar(length/2));
  const layers=textureName==='lux_r_beam.png'?
    [{texture:'lux_r_beam.png',scale:2.4,opacity:.26,tint:'#9caeff'},{texture:'lux_r_core.png',scale:1.35,opacity:.62,tint:'#dbe5ff'},{texture:'lux_r_beam.png',scale:.52,opacity:.98,tint:'#ffffff'}]:
    [{texture:'xerath_q_01.png',scale:2.4,opacity:.25,tint:color},{texture:'xerath_q.png',scale:1.2,opacity:.52,tint:'#d8c8ff'},{texture:'xerath_q_energy.png',scale:.48,opacity:.86,tint:'#ffffff'}];
  const solidLayers=textureName==='lux_r_beam.png'?
    [{scale:1.7,opacity:.13,tint:'#8c9eff'},{scale:.72,opacity:.22,tint:'#c7d2ff'},{scale:.22,opacity:.52,tint:'#ffffff'}]:
    [{scale:1.8,opacity:.19,tint:'#9d71ff'},{scale:.82,opacity:.3,tint:'#c9aaff'},{scale:.24,opacity:.68,tint:'#f5eaff'}];
  for(const layer of solidLayers){const geometry=new THREE.PlaneGeometry(length,width*layer.scale);geometry.rotateX(-Math.PI/2);const material=new THREE.MeshBasicMaterial({color:layer.tint,transparent:true,opacity:layer.opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(geometry,material);mesh.position.y=90;mesh.rotation.y=yaw;group.add(mesh);}
  for(const layer of layers){const material=new THREE.MeshBasicMaterial({map:loadTexture(layer.texture),color:layer.tint,transparent:true,opacity:layer.opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});const geometry=new THREE.PlaneGeometry(length,width*layer.scale);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,material);mesh.position.y=layer.scale<.6?92:88;mesh.rotation.y=yaw;group.add(mesh);}
  group.position.set(mid.x,0,mid.z);scene.add(group);return group;
}
function makeSprite(textureName,color,scale){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:loadTexture(textureName),color,transparent:true,depthWrite:false,opacity:.96}));sprite.scale.set(scale,scale,1);return sprite;}
function makeTelegraph(start,direction,length,color){
  // A fine, low-opacity aiming cue communicates direction and timing without
  // drawing the projectile's hitbox as a wide colored lane.
  const lane=makeGroundLane(start,direction,length,13,color,.2),center=makeGroundLane(start,direction,length,2,'#fff8df',.62);
  return {lane,center};
}
function groundTexture(texture,diameter,color,opacity=1){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(diameter,diameter),new THREE.MeshBasicMaterial({map:loadTexture(texture),color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));mesh.rotation.x=-Math.PI/2;return mesh;
}
function makeCircleWarning(endpoint,skill){
  const lane=new THREE.Group(),center=new THREE.Group();lane.position.set(endpoint.x,2,endpoint.z);center.position.copy(lane.position);
  lane.add(groundTexture('brand_w_charge.png',skill.width,skill.color,.7));
  const border=groundTexture('brand_w_border.png',skill.width,'#ffb55c',.9);border.position.y=1;center.add(border);
  scene.add(lane,center);return {lane,center};
}
function makeCircleImpact(endpoint,skill){
  const group=new THREE.Group();group.position.set(endpoint.x,3,endpoint.z);
  group.add(groundTexture('brand_w_cracks.png',skill.width,'#ffb552',.95));
  for(let i=0;i<4;i++){const flame=new THREE.Mesh(new THREE.PlaneGeometry(skill.width*.75,390),new THREE.MeshBasicMaterial({map:loadTexture('brand_w_pillar.png'),color:'#ffb667',transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));flame.position.y=175;flame.rotation.y=i*Math.PI/4;group.add(flame);}
  scene.add(group);return group;
}
function chooseAimPoint(skill,origin,plannedMode){
  const mode=session?(plannedMode??(random()<drills[session.config.drill].leadChance?'lead':'current')):(aimLeadNext?'lead':'current');aimLeadNext=!aimLeadNext;lastAimMode=mode;
  const aim=position.clone();
  if(session?.config.trainingProfile==='advanced'){const observed=movementObserver.aim(session.time,origin,skill,{reaction:({1:.2,2:.14,3:.1})[session.config.difficulty],lead:mode==='lead',strength:.8+random()*.2});if(observed)return {aim:new THREE.Vector3(observed.x,0,observed.z),mode};}
  if(mode==='lead'&&playerVelocity.lengthSq()>.01){
    const distance=origin.distanceTo(aim),flight=Number.isFinite(skill.speed)?distance/skill.speed:0;
    const horizon=Math.min(.82,skill.warning+flight),lead=playerVelocity.clone().multiplyScalar(horizon);
    if(lead.length()>360)lead.setLength(360);aim.add(lead);
  }
  return {aim,mode};
}
function makeWarning(skill,enemy,replay=null){
  if(replay)skill={...skill,...replay.parameters,range:Math.hypot(replay.endpoint.x-replay.origin.x,replay.endpoint.z-replay.origin.z),hitWidth:Math.max(0,2*(replay.radius-ownGameplayRadius)),warning:replay.warning,speed:replay.parameters?.speed??skill.speed};
  selectEnemySkill(enemy,skill);
  const origin=enemy.group.position.clone(),{aim,mode}=replay?{aim:replay.endpoint,mode:replay.aimMode}:chooseAimPoint(skill,origin,enemy.plannedAimMode);
  const endpoint=castEndpoint(skill,origin,aim),vector=new THREE.Vector3(endpoint.x-origin.x,0,endpoint.z-origin.z),length=vector.length(),direction=vector.normalize();
  enemy.targetYaw=Math.atan2(direction.x,direction.z);
  enemy.moving=false;enemy.hasCast=true;setEnemyLocomotion(enemy);
  playEnemyCast(enemy);
  enemy.castRemaining=Math.max(enemy.castRemaining,skill.warning);
  const {lane,center}=skill.kind==='circle'?makeCircleWarning(endpoint,skill):makeTelegraph(origin,direction,length,skill.color);
  const assisted=session?.config.trainingProfile!=='advanced';
  lane.visible=assisted||skill.kind==='beam'||skill.kind==='circle';center.visible=skill.kind==='circle'||assisted;
  const shot=session?.beginShot({skill,origin,endpoint,direction,position,target,velocity:playerVelocity,aimMode:mode,radius:(skill.hitWidth??skill.width)/2+ownGameplayRadius});
  const warning={skill,enemy,origin,direction,length,endpoint,shot,aimMode:mode,aimPoint:new THREE.Vector3(aim.x,0,aim.z),remaining:skill.warning,lane,center};warnings.push(warning);casts++;updateCounters();$('incomingName').textContent=`${skill.champion.toUpperCase()}  ${skill.key} · ${skill.name}`;$('incoming').hidden=!assisted;$('incomingTimer').textContent=skill.warning.toFixed(2);
}
function removeObject(object,disposeGeometry=true){if(!object)return;scene.remove(object);object.traverse?.(child=>{if(disposeGeometry&&child.geometry&&!child.isSprite)child.geometry.dispose();if(child.material&&!child.material.map)child.material.dispose();});}
function captureMaterialOpacity(object){const materials=[];object.traverse(child=>{for(const material of (Array.isArray(child.material)?child.material:child.material?[child.material]:[]))materials.push({material,opacity:material.opacity});});return materials;}
function launchWarning(warning){
  removeObject(warning.lane);removeObject(warning.center);
  const {skill,origin,direction,length,endpoint,shot}=warning;
  warning.enemy.dismissWhenCastComplete=true;
  if(skill.kind==='circle'){
    const clearance=hazardDistance(position,skill,origin,endpoint)-(skill.width/2+ownGameplayRadius);
    session?.clearance(shot,clearance);if(clearance<=0)registerHit(skill,shot);else registerDodge(skill,shot);
    const object=makeCircleImpact(endpoint,skill);effects.push({object,remaining:.6,duration:.6,kind:'pillar',materials:captureMaterialOpacity(object)});return;
  }
  if(skill.kind==='beam'){
    const beam=makeBeam(origin,direction,length,Math.max(80,skill.width),skill.color,skill.texture),hit=skillshotHitsPoint(position,origin,endpoint,skill.hitWidth??skill.width,ownGameplayRadius);
    session?.clearance(shot,pointSegmentDistanceXZ(position,origin,endpoint)-((skill.hitWidth??skill.width)/2+ownGameplayRadius));
    if(hit)registerHit(skill,shot);else registerDodge(skill,shot);
    effects.push({object:beam,remaining:.28,kind:'beam',materials:captureMaterialOpacity(beam)});return;
  }
  const visual=makeSkillProjectile(skill,origin,direction),sprite=visual.object;
  sprite.position.set(origin.x,visual.height,origin.z);scene.add(sprite);
  const trail=makeProjectileTrail(skill,origin,direction);
  projectiles.push({skill,shot,bornAt:elapsed,origin:origin.clone(),direction:direction.clone(),endpoint,range:length,travelled:0,sprite,trail,height:visual.height,visual,sharedGeometry:visual.sharedGeometry});
}
function makeSkillProjectile(skill,origin,direction){
  const group=new THREE.Group();
  const yaw=Math.atan2(direction.x,direction.z);group.rotation.y=yaw;
  let height=100,sharedGeometry=false;
  if(skill.id==='nautilusQ'&&nautilusAnchor){
    // The shipped anchor mesh is authored upright. Lay it along the flight
    // vector and preserve the normalization scale so it flies point-first.
    const anchor=nautilusAnchor.clone(true);
      // The extracted mesh's broad anchor head is at -Y, with the shank at +Y.
      // Rotate -Y onto local +Z so the head leads along the projectile path.
      const flightPose=new THREE.Group();flightPose.rotation.x=-Math.PI/2;flightPose.add(anchor);group.add(flightPose);
    const glow=makeSprite('nautilus.png',skill.color,78);glow.material.opacity=.19;glow.position.y=1;group.add(glow);height=145;sharedGeometry=true;
  }else if(skill.id==='threshQ'){
    const head=makeSprite('thresh_q_head.png',skill.color,86);head.scale.set(58,58,1);head.material.opacity=.9;group.add(head);
    const core=new THREE.Mesh(new THREE.SphereGeometry(15,16,12),new THREE.MeshBasicMaterial({color:'#b9ffd2',transparent:true,opacity:.72}));group.add(core);
  }else if(skill.id==='luxR'){
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(22,1),new THREE.MeshBasicMaterial({color:'#f5f1ff',emissive:'#9da9ff',emissiveIntensity:1.3,transparent:true,opacity:.94}));group.add(orb);
    const glow=makeSprite('lux_q_cap.png','#dbe0ff',58);glow.material.opacity=.75;group.add(glow);
  }else if(skill.id==='ezrealQ'){
    // Mystic Shot reads as a compact magical bolt with a bright core and a
    // tapered energy wake, not a physical arrow.
    const aura=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:'#1688ff',transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false}));aura.scale.set(13,13,27);aura.position.z=-2;group.add(aura);
    const core=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:'#d9f5ff',transparent:true,opacity:.96,blending:THREE.AdditiveBlending,depthWrite:false}));core.scale.set(6,6,15);core.position.z=2;group.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(10,1.6,6,24),new THREE.MeshBasicMaterial({color:'#5cbdff',transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false}));ring.rotation.x=.32;ring.position.z=-3;group.add(ring);
    const wake=new THREE.Mesh(new THREE.PlaneGeometry(44,11),new THREE.MeshBasicMaterial({map:loadTexture('ezreal_q_trail.png'),color:'#3b9fff',transparent:true,opacity:.54,depthWrite:false,side:THREE.DoubleSide}));wake.rotation.y=Math.PI/2;wake.position.z=-23;group.add(wake);
  }else if(skill.id==='blitzcrankQ'){
    if(blitzcrankFist){group.add(blitzcrankFist.clone(true));sharedGeometry=true;}
    else group.add(new THREE.Mesh(new THREE.BoxGeometry(65,55,65),new THREE.MeshStandardMaterial({color:'#c89c56',metalness:.7,roughness:.4})));
    const glow=makeSprite('blitzcrank_base_q_glow_01.png','#f7d28c',100);glow.material.blending=THREE.AdditiveBlending;glow.material.opacity=.6;group.add(glow);
  }else if(['morganaQ','brandQ','luxQ','xerathE'].includes(skill.id)){
    const core=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),new THREE.MeshBasicMaterial({color:skill.id==='morganaQ'?'#261132':skill.color,transparent:true,opacity:.9}));core.scale.set(skill.width*.19,skill.width*.19,skill.width*.3);group.add(core);
    const head=makeSprite(skill.texture,skill.color,skill.width*1.15);head.material.blending=THREE.AdditiveBlending;group.add(head);
    const texture=skill.id==='morganaQ'?'morgana_base_q_firetrail.png':skill.id==='brandQ'?'brand_q_flame.png':skill.id==='luxQ'?'lux_q_trail.png':'xerath_q_energy.png';
    for(let i=0;i<2;i++){const wake=new THREE.Mesh(new THREE.PlaneGeometry(skill.width*.7,165),new THREE.MeshBasicMaterial({map:loadTexture(texture),color:skill.color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));wake.rotation.x=Math.PI/2;wake.rotation.y=i*Math.PI/2;wake.position.z=-65;group.add(wake);}
  }
  if(skill.id==='threshQ'){
    const flare=makeSprite(skill.id==='threshQ'?'thresh_q_trail.png':'lux_q_trail.png',skill.color,88);flare.scale.set(66,100,1);flare.position.z=50;flare.material.opacity=.58;group.add(flare);
  }
  return {object:group,height,sharedGeometry};
}
function makeProjectileTrail(skill,origin,direction){
  if(skill.id==='ezrealQ')return null;
  if(skill.id==='nautilusQ'||skill.id==='blitzcrankQ')return makeNautilusChain();
  if(['morganaQ','brandQ','luxQ','xerathE'].includes(skill.id))return null;
  const texture=skill.trail||({nautilusQ:'nautilus.png',threshQ:'thresh_q_trail.png',ezrealQ:'ezreal_q_trail.png'}[skill.id]);
  const trail=makeGroundLane(origin,direction,1,Math.max(18,skill.width*.18),skill.color,.4,texture);
  trail.position.y=4;return trail;
}
function makeNautilusChain(){
  const chain=new THREE.Group(),geometry=new THREE.TorusGeometry(7.5,2.3,6,10),material=new THREE.MeshStandardMaterial({color:'#9aa9a5',emissive:'#263f3b',emissiveIntensity:.32,metalness:.72,roughness:.3});
  for(let i=0;i<56;i++){const link=new THREE.Mesh(geometry,material);link.castShadow=true;link.userData.linkIndex=i;chain.add(link);}
  scene.add(chain);return chain;
}
function updateNautilusChain(chain,origin,direction,travelled,height){
  if(!chain)return;const links=chain.children,last=links.length-1,normal=new THREE.Vector3(0,0,1),orientation=new THREE.Quaternion().setFromUnitVectors(normal,direction);
  for(let i=0;i<links.length;i++){const t=last?i/last:0,distance=Math.max(0,travelled-57.5)*t,link=links[i];link.position.set(origin.x+direction.x*distance,height,origin.z+direction.z*distance);link.quaternion.copy(orientation);if(i%2)link.rotateY(Math.PI/2);}
}
function registerHit(skill,shot){hits++;session?.resolve(shot,true,position);combat?.takeDamage(100);$('hitFlash').hidden=false;$('hitFlash').textContent=`ATINGIDA · ${skill.champion} ${skill.key}`;setTimeout(()=>{$('hitFlash').hidden=true;},650);const burst=new THREE.Mesh(new THREE.RingGeometry(24,40,48),new THREE.MeshBasicMaterial({color:'#ff7869',transparent:true,opacity:.95,side:THREE.DoubleSide}));burst.rotation.x=-Math.PI/2;burst.position.set(position.x,4,position.z);scene.add(burst);effects.push({object:burst,remaining:.5,kind:'burst',materials:captureMaterialOpacity(burst)});updateCounters();}
function registerDodge(skill,shot){dodged++;session?.resolve(shot,false,position);updateCounters();}
function updateCounters(){$('dodged').textContent=String(dodged);$('hits').textContent=String(hits);$('casts').textContent=String(casts);}
function enabledSkills(){return session?session.config.skills.map(id=>dodgeSkills[id]):[...document.querySelectorAll('[data-skill]:checked')].map(input=>dodgeSkills[input.dataset.skill]).filter(Boolean);}
function groundPointAtNdc(x,y){const previous=mouse.clone();mouse.set(x,y);raycaster.setFromCamera(mouse,camera);const point=raycaster.ray.intersectPlane(ground,new THREE.Vector3());mouse.copy(previous);return point;}
function cornerSpawn(enemy,index){
  const corners=[[-.84,.74],[.84,.74],[-.84,-.74],[.84,-.74]],corner=corners[index%corners.length],point=groundPointAtNdc(...corner);
  let direction=point?new THREE.Vector3(point.x-position.x,0,point.z-position.z):new THREE.Vector3(corner[0],0,-corner[1]);
  if(direction.lengthSq()<.001)direction.set(1,0,0);direction.normalize();
  const distance=Math.max(780+random()*120,(enemy.engagement?.distance??620)+90);enemy.group.position.set(position.x+direction.x*distance,0,position.z+direction.z*distance);
  enemy.targetYaw=Math.atan2(-direction.x,-direction.z);enemy.group.visible=true;enemy.active=true;enemy.moving=true;enemy.castRemaining=0;setEnemyLocomotion(enemy);
}
function beginWave(){
  waveEnemies.length=0;
  const pool=enabledSkills().filter(skill=>[...enemies.values()].some(e=>e.model&&e.skills.includes(skill.id)));
  const available=new Set(pool.map(s=>s.champion)).size;
  if(!available){$('status').textContent='Ative ao menos uma habilidade';waveCooldown=.4;return;}
  wavePlan=dodgeWavePlan(random,{difficulty:session?.config.difficulty??2,drill:session?.config.drill??'rhythm',available,advanced:session?.config.trainingProfile==='advanced'});
  const selected=dodgeDeck.draw(pool.map(s=>s.id),wavePlan.count,id=>dodgeSkills[id].champion);
  waveNumber++;waveRemaining=10;waveCastIndex=0;lastWaveCastAt=null;
  for(let i=0;i<selected.length;i++){
    const skill=dodgeSkills[selected[i]],enemy=[...enemies.values()].find(e=>e.skills.includes(skill.id));selectEnemySkill(enemy,skill);
    enemy.hasCast=false;enemy.dismissWhenCastComplete=false;enemy.engagement=engagementPlan(random,session?.config.difficulty??2,session?.config.trainingProfile==='advanced');
    if(skill.kind==='missile')enemy.engagement.distance=Math.min(skill.range*.92,Math.max(enemy.engagement.distance,skill.speed*(wavePlan.minimumResponseTime-skill.warning)));
    else enemy.engagement.distance=Math.min(enemy.engagement.distance,skill.range*.85);
    enemy.castEligibleAt=null;enemy.plannedAimMode=wavePlan.aimModes[i];waveEnemies.push(enemy);cornerSpawn(enemy,wavePlan.cornerIndices[i]);
  }
  $('status').textContent=`● Onda ${waveNumber} · ${selected.length} ${selected.length===1?'campeão':'campeões'} · ${wavePlan.pattern==='crossfire'?'fogo cruzado':wavePlan.pattern==='sweep'?'ataques alternados':'leitura individual'}`;
}
function endWave(){for(const enemy of waveEnemies){enemy.active=false;enemy.moving=false;enemy.group.visible=false;enemy.castRemaining=0;enemy.hasCast=false;enemy.dismissWhenCastComplete=false;setEnemyLocomotion(enemy);}waveEnemies.length=0;waveCooldown=(wavePlan?.cooldownFactor??.65)*(session?.config.pace??+$('pace').value);}
function scheduleAttack(){
  if(!waveEnemies.length)return false;
  const ready=waveEnemies.filter(e=>e.active&&!e.hasCast&&e.group.position.distanceTo(position)<=(e.engagement?.distance??620)+5);
  for(const e of ready)e.castEligibleAt??=elapsed+(e.engagement?.delay??0);
  const enemy=ready.find(e=>elapsed>=e.castEligibleAt);if(!enemy)return false;
  const gap=waveCastIndex>0?wavePlan.castOffsets[waveCastIndex]-wavePlan.castOffsets[waveCastIndex-1]:0;
  if(elapsed<enemy.castEligibleAt||(lastWaveCastAt!=null&&elapsed<lastWaveCastAt+gap))return false;
  lastSkillId=enemy.skill.id;makeWarning(enemy.skill,enemy);lastWaveCastAt=elapsed;waveCastIndex++;return true;
}
function setChallenge(active){
  if(session&&session.state!=='finished'){
    if(active)session.state=session.resumeState||'running';
    else{session.resumeState=session.state==='draining'?'draining':'running';session.state='paused';}
  }
  challengeActive=active&&session?.state==='running'&&!session.config.rehearsal&&session.config.drill!=='yone'&&session.config.drill!=='lane'&&session.config.drill!=='vault'&&!matchupProfiles[session.config.drill]&&(session.config.drill!=='combat'||session.config.combatHazards!==false);
  $('status').textContent=active?'● Treino em andamento · Esc para pausar':'Treino pausado · tempo e habilidades congelados';
  ui?.update(session);
}
function clearHazards(){for(const w of warnings){removeObject(w.lane);removeObject(w.center);}warnings.length=0;for(const p of projectiles){removeObject(p.sprite,!p.sharedGeometry);removeObject(p.trail);}projectiles.length=0;for(const effect of effects)removeObject(effect.object);effects.length=0;$('incoming').hidden=true;}
function resetChallenge(){vault=null;vaultView.bind(null);$('vaultHud').hidden=true;lane=null;laneView.bind(null);$('laneHud').hidden=true;matchup=null;matchupShots.clear();matchupView.bind(null);$('matchupHud').hidden=true;yone=null;yoneShots.clear();yoneView.bind(null);yoneEffects.clear();$('yoneHud').hidden=true;playerAnimator?.reset();session=null;combat=null;dodgeFlash=new DodgeFlash();attackArmed=false;combatView.bind(null);$('attackHud').hidden=true;setChallenge(false);clearHazards();endWave();for(const enemy of enemies.values()){enemy.active=false;enemy.moving=false;enemy.castRemaining=0;enemy.dismissWhenCastComplete=false;enemy.hasCast=false;enemy.group.position.copy(enemy.initialPosition);enemy.group.visible=false;setEnemyLocomotion(enemy);}waveNumber=0;waveRemaining=0;waveCooldown=0;wavePlan=null;waveCastIndex=0;lastWaveCastAt=null;aimLeadNext=false;lastAimMode='current';position.set(0,0,0);playerVelocity.set(0,0,0);target.copy(position);focus.copy(position);moving=false;elapsed=0;dodged=0;hits=0;casts=0;lastSkillId='';nextAttack=0;updateCounters();$('hitFlash').hidden=true;$('clickFeedback').hidden=true;$('status').textContent='● Escolha um fundamento e comece seu bloco';ui?.update(null);}

function startPlaylist(options){
  if(playlist||(session&&session.state!=='finished'))return;
  const base=ui.config();if(!base.skills.length)base.skills=Object.keys(dodgeSkills);
  playlist=new TrainingPlaylist(base,options);void beginPlaylistBlock(playlist);
}
async function beginPlaylistBlock(run){
  if(playlist!==run||run.loading)return;
  run.loading=true;run.error=null;ui.update(session);
  const config=run.config();
  try{
    ui.applyConfig(config);
    await startSession(config);
    if(playlist!==run)return;
    if(session?.config.playlistId!==run.id||session.config.playlistIndex!==run.index)throw new Error('Os modelos do bloco ainda não estão disponíveis.');
    run.loading=false;
    if(document.hidden)setChallenge(false);
  }catch(error){if(playlist!==run)return;run.loading=false;run.error=error.message;$('status').textContent='Não foi possível iniciar o bloco. Tente carregar novamente.';}
  ui.update(session);
}
function stopPlaylist(){
  if(!playlist)return finishSession();
  const run=playlist;run.stopping=true;
  if(run.loading||run.error||!session||session.state==='finished'){
    playlist=null;ui.update(session);ui.showPlaylistSummary(run);return;
  }
  finishSession();
}
function resetUserTraining(){playlist=null;resetChallenge();}
function startSession(config=ui.config()){
  if(config.playlistId&&config.playlistId!==playlist?.id)return;
  config=trainingConfig({champion:$('championSelect').value,level:6,attackSpeed:1.5,attackPriority:'cursor',bindLeft:true,combatHazards:true,combatCircuit:'on',...config});
  if(config.drill==='vault'&&config.champion!=='quinn')config={...config,champion:'quinn',speed:330};
  if(config.champion!==championId||championLoading)return selectChampion(config.champion,{defaults:false}).then(ok=>ok?startSession(config):undefined);
  const vaultMode=config.drill==='vault',laneMode=config.drill==='lane',matchupMode=!!matchupProfiles[config.drill],yoneMode=config.drill==='yone',combatMode=config.drill==='combat'||yoneMode||laneMode||vaultMode,hazards=!vaultMode&&!laneMode&&!matchupMode&&!yoneMode&&(!combatMode||config.combatHazards);
  if(vaultMode){config={...config,skills:[],combatCircuit:'off',combatHazards:false,vaultVersion:1};if(!vaultView.ready)return vaultView.load().then(()=>startSession(config)).catch(error=>{console.error(error);$('status').textContent='Falha ao carregar LeBlanc';});}
  if(laneMode){config={...config,skills:[],combatCircuit:'off',combatHazards:false,laneVersion:2};if(!laneView.ready)return laneView.load().then(()=>startSession(config)).catch(error=>{console.error(error);$('status').textContent='Falha ao carregar adversária da lane';});}
  if(matchupMode){config={...config,matchupVersion:1,skills:config.drill==='ahri'&&config.matchupPattern==='q'?['ahriQ','ahriQReturn']:config.drill==='ahri'&&config.matchupPattern==='e'?['ahriE']:matchupProfiles[config.drill].skills};if(!matchupView.models.has(config.drill)){$('status').textContent='Carregando '+matchupProfiles[config.drill].name+'…';return matchupView.load(config.drill).then(()=>startSession(config)).catch(error=>{console.error(error);$('status').textContent='Falha ao carregar o adversário. Tente novamente.';});}}
  if(yoneMode){config={...config,yoneRatingVersion:4,yoneBonusAS:yoneRating(config.difficulty).bonusAS*100,combatCircuit:'off',combatHazards:false,skills:config.yonePattern==='full'?Object.keys(yoneSkills):['yoneQ','yoneQ3']};if(!yoneView.ready){$('status').textContent='Carregando modelo e animações do Yone…';return yoneView.load().then(()=>{if(yoneView.ready)return startSession(config);});}}
  if(!model||(hazards&&config.skills.some(id=>![...enemies.values()].find(e=>e.skills.includes(id))?.model))||(combatMode&&!combatView.ready)){$('status').textContent='Aguarde os modelos terminarem de carregar';return;}
  if(hazards&&!config.skills.length){$('status').textContent='Selecione pelo menos uma habilidade nos ajustes';return;}
  
  resetChallenge();movementObserver=new MovementObserver();movementObserver.record(0,position);session=new TrainingSession(config);dodgeFlash=new DodgeFlash();dodgeDeck=new DodgeDeck(session.random);speed=config.speed;challengeActive=hazards;nextAttack=.4;
  if(combatMode){const Engine=championId==='quinn'?QuinnCombat:championId==='syndra'?SyndraCombat:championId==='leblanc'?LeBlancCombat:Combat;combat=new Engine({advanced:config.trainingProfile==='advanced'&&config.drill==='combat',champion:championId,level:config.level,attackSpeed:config.attackSpeed,priority:config.attackPriority,circuit:config.combatCircuit==='on',difficulty:config.difficulty,random:session.random,bonusAD:config.bonusAD,critChance:config.critChance,abilityPower:config.abilityPower,unlimitedMana:config.unlimitedMana,abilityHaste:config.abilityHaste,syndraSplinters:config.syndraSplinters,targets:vaultMode?[{id:'vault-leblanc',kind:'champion',position:{x:0,z:-550},maxHealth:3000}]:laneMode?laneTargets():yoneMode?[{id:'yone',position:{x:0,z:650},maxHealth:1800}]:(config.drill==='combat'&&config.trainingProfile==='advanced'&&config.combatCircuit==='on'?[{id:'ryze-1',position:{x:-320,z:-230}},{id:'ryze-2',position:{x:350,z:-180}},{id:'ryze-3',position:{x:0,z:-440}}].map(t=>({...t,maxHealth:championId==='syndra'?3000:600})):undefined)});combatView.bind(combat);session.combat=combat.summary();$('controls').hidden=true;$('attackHud').hidden=false;}
  if(vaultMode){vault=new VaultEncounter({combat,random:session.random,difficulty:config.difficulty,interval:config.pace,advanced:config.trainingProfile==='advanced'});vaultView.bind(vault);$('vaultHud').hidden=false;}
  if(laneMode){lane=new LaneEncounter({combat,random:session.random,difficulty:config.difficulty,coach:config.laneCoach!==false,advanced:config.trainingProfile==='advanced'});laneView.bind(lane);focus.set(0,0,-300);$('laneHud').hidden=false;}
  if(yoneMode){yone=new YoneEncounter({target:combat.target('yone'),random:session.random,pattern:config.yonePattern??'eq',initialStacks:config.yoneStacks??2,difficulty:config.difficulty,advanced:config.trainingProfile==='advanced'});yoneView.bind(yone);$('yoneHud').hidden=false;}
  if(matchupMode){matchup=new MatchupEncounter({champion:config.drill,difficulty:config.difficulty,random:session.random,interval:config.pace,pattern:config.matchupPattern??'mixed',advanced:config.trainingProfile==='advanced'});matchupView.bind(matchup);$('matchupHud').hidden=false;$('controls').hidden=true;}
  if(hazards)beginWave();else $('status').textContent=vaultMode?'● Quinn × LeBlanc · intercepte o W com o E no alvo':laneMode?'● Lane · observe o last hit e acerte o poke durante o autoattack':matchupMode?'● Esquiva · '+matchupProfiles[config.drill].name+' em aproximação':yoneMode?'● Duelo · Yone usa E, persegue e retorna. Leia os Qs e reposicione.':'● Aquecimento · ataque os alvos e reposicione entre os disparos';ui.update(session);
}
function finishSession(){
  if(!session||session.state==='finished')return;
  challengeActive=false;session.state='draining';session.drainStarted=true;session.attackStoppedAt??=session.time;attackArmed=false;combat?.endAttacks();vault?.stop();lane?.stop();yone?.stop();matchup?.stop();
  for(const enemy of waveEnemies){enemy.active=false;enemy.moving=false;if(!enemy.hasCast)enemy.group.visible=false;setEnemyLocomotion(enemy);}
  ui.update(session);
}
function completeSession(){
  challengeActive=false;session.state='finished';target.copy(position);endWave();
  attackArmed=false;$('attackHud').hidden=true;
  const report=session.report();report.playlistKnockouts=session.playlistKnockouts??0;ui.save(report);
  if(playlist&&session.config.playlistId===playlist.id){
    const run=playlist;if(run.complete(report)){void beginPlaylistBlock(run);return;}
    playlist=null;ui.update(session);ui.showPlaylistSummary(run);$('status').textContent=run.stopping?'● Playlist encerrada':'● Playlist concluída · revise seus blocos';return;
  }
  ui.update(session);ui.showReport(report);$('status').textContent='● Bloco concluído · revise e repita as situações';
}
function retryShot(shot,config){
  if(matchupSkills[shot.skill]){const prepare=()=>{if(!matchup)return;position.set(shot.start.x,0,shot.start.z);target.copy(position);focus.copy(position);matchup.replay(shot);};const started=startSession({...config,drill:shot.skill.startsWith('ahri')?'ahri':'locke',duration:15,rehearsal:true});if(started?.then)return started.then(prepare);prepare();return;}
  if(shot.skill.startsWith('yone')){const prepare=()=>{if(!yone)return;position.set(shot.start.x,0,shot.start.z);target.copy(position);focus.copy(position);yone.replay(shot);};const started=startSession({...config,drill:'yone',duration:15,rehearsal:true});if(started?.then)return started.then(prepare);prepare();return;}
  if((config.champion??'kayle')!==championId||championLoading)return selectChampion(config.champion??'kayle',{defaults:false}).then(ok=>ok?retryShot(shot,config):undefined);
  resetChallenge();session=new TrainingSession({...config,skills:[shot.skill],duration:15,rehearsal:true});speed=config.speed;
  position.set(shot.start.x,0,shot.start.z);target.set(shot.initialTarget.x,0,shot.initialTarget.z);focus.copy(position);playerVelocity.set(shot.velocity.x,0,shot.velocity.z);
  const enemy=[...enemies.values()].find(e=>e.skills.includes(shot.skill));enemy.group.position.set(shot.origin.x,0,shot.origin.z);enemy.group.visible=true;
  enemy.group.rotation.y=Math.atan2(shot.direction.x,shot.direction.z);makeWarning(dodgeSkills[shot.skill],enemy,shot);challengeActive=false;ui.update(session);
  $('status').textContent='● Repetição · mesma posição e mesma mira. Experimente outra saída.';
}

function pointAtPointer(event){mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);const point=new THREE.Vector3();return raycaster.ray.intersectPlane(ground,point)?point:null;}
function useDodgeFlash(){
  if(!session||session.state!=='running'||!FLASH_MODES.has(session.config.drill)||matchup?.charmed)return false;
  raycaster.setFromCamera(mouse,camera);const aim=new THREE.Vector3();if(!raycaster.ray.intersectPlane(ground,aim))return false;
  const jump=dodgeFlash.cast(session.time,position,aim);if(!jump)return false;
  session.command(jump.from,jump.to,'flash');session.flashUses=dodgeFlash.uses;
  for(const p of [jump.from,jump.to]){const object=ring(45,'#ffe6a1',.9);object.position.set(p.x,12,p.z);scene.add(object);effects.push({object,remaining:.3,duration:.3,kind:'flash',materials:captureMaterialOpacity(object)});}
  position.set(jump.to.x,0,jump.to.z);previousPlayerPosition.copy(position);target.copy(position);actor.position.copy(position);playerVelocity.set(0,0,0);moving=false;
  movementObserver.record(session.time,position);
  return true;
}
let clickFeedbackTimer;
function issueMove(point){
  if(session&&['paused','finished'].includes(session.state))return;
  if(matchup?.charmed)return;
  attackArmed=false;playerAnimator?.cancelPreview?.();combat?.move(point);
  target.set(THREE.MathUtils.clamp(point.x,-7000,7000),0,THREE.MathUtils.clamp(point.z,-7000,7000));session?.command(position,target);
  const distance=position.distanceTo(target),close=distance<=(session?.config.closeRadius??+$('closeRadius').value);
  const marker=ring(10,close?'#c2e3a9':'#cabb8d',.85);marker.position.set(target.x,2,target.z);scene.add(marker);effects.push({object:marker,remaining:.28,kind:'click',materials:captureMaterialOpacity(marker)});
  if(session){$('clickFeedback').textContent=`${Math.round(distance)} u · ${close?'clique próximo':'clique distante'}`;$('clickFeedback').hidden=false;clearTimeout(clickFeedbackTimer);clickFeedbackTimer=setTimeout(()=>$('clickFeedback').hidden=true,800);}
}
function issueAttackMove(point){
  if(!combat||session?.state!=='running'||(yone&&yone.time<yone.playerLockedUntil))return;
  attackArmed=false;combat.attackMove(point,position);session.command(position,point,'attackMove');
  const marker=ring(14,'#f59c80',.95);marker.position.set(point.x,2,point.z);scene.add(marker);effects.push({object:marker,remaining:.28,kind:'click',materials:captureMaterialOpacity(marker)});
}
function issueAttackTarget(id){
  if(!combat||session?.state!=='running'||(yone&&yone.time<yone.playerLockedUntil))return;
  attackArmed=false;combat.attackTarget(id);session.command(position,combat.target(id).position,'attackTarget');
}
function issueStop(){
  if(matchup?.charmed)return;
  if(session&&['paused','finished'].includes(session.state))return;
  attackArmed=false;playerAnimator?.cancelPreview?.();combat?.stop();target.copy(position);playerVelocity.set(0,0,0);moving=false;
  session?.command(position,position,'stop');
  $('clickFeedback').textContent='Parado · S';$('clickFeedback').hidden=false;
  clearTimeout(clickFeedbackTimer);clickFeedbackTimer=setTimeout(()=>$('clickFeedback').hidden=true,650);
}
function useCombatAbility(key){
  if(!combat||session?.state!=='running'||(yone&&yone.time<yone.playerLockedUntil))return;
  if(combat.castAbility){
    raycaster.setFromCamera(mouse,camera);const point=new THREE.Vector3();if(!raycaster.ray.intersectPlane(ground,point))return;
    const targetId=vaultView.pick(raycaster)??laneView.pick(raycaster)??yoneView.pick(raycaster)??combatView.pick(raycaster)??combat.targets.filter(t=>t.alive&&Math.hypot(t.position.x-point.x,t.position.z-point.z)<=t.radius).sort((a,b)=>Math.hypot(a.position.x-point.x,a.position.z-point.z)-Math.hypot(b.position.x-point.x,b.position.z-point.z))[0]?.id;
    if(combat.castAbility(key,point,position,targetId)){attackArmed=false;session.command(position,point,key);}
  }else if((key==='E'&&combat.castE())||(key==='W'&&combat.castW()))session.command(position,position,key);
}
$('castE').onclick=()=>useCombatAbility('E');$('castW').onclick=()=>useCombatAbility('W');
for(const key of ['Q','W','E','R'])$(`lbCast${key}`).onclick=()=>{useCombatAbility(key);renderer.domElement.focus({preventScroll:true});};
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
renderer.domElement.addEventListener('pointermove',event=>{mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);pointerInside=true;});
renderer.domElement.addEventListener('pointerleave',()=>pointerInside=false);
// mousedown fires for each physical button, including a second button pressed
// while the first is held. pointerdown/click would lose that kiting input.
renderer.domElement.addEventListener('mousedown',event=>{
  if(event.button!==0&&event.button!==2)return;
  renderer.domElement.focus({preventScroll:true});
  const point=pointAtPointer(event);if(!point)return;
  if(event.button===2){event.preventDefault();const id=vaultView.pick(raycaster)??laneView.pick(raycaster)??yoneView.pick(raycaster)??combatView.pick(raycaster);if(combat&&id)issueAttackTarget(id);else issueMove(point);}
  else if(combat&&(attackArmed||session.config.bindLeft)){event.preventDefault();issueAttackMove(point);}
});
const autoPause=()=>{pointerInside=false;if(session&&['running','draining'].includes(session.state))setChallenge(false);};
window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
window.addEventListener('keydown',event=>{
  if($('results').open)return;
  if(event.code==='Escape'&&!event.repeat&&session&&session.state!=='finished'){event.preventDefault();if(attackArmed)attackArmed=false;else setChallenge(session.state==='paused');return;}
  if(document.activeElement.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))return;
  if(event.code==='KeyF'&&!event.repeat){event.preventDefault();useDodgeFlash();}
  if(/^Key[QWER]$/.test(event.code)&&!event.repeat&&combat){event.preventDefault();useCombatAbility(event.code.slice(3));}
  if(event.code==='KeyA'&&combat&&session?.state==='running'){event.preventDefault();attackArmed=true;}
  if(event.code==='Space'){event.preventDefault();locked=false;$('locked').checked=false;focus.copy(position);}
  if(event.code==='KeyS'){event.preventDefault();if(!event.repeat)issueStop();}
  if(event.code==='KeyY'&&!event.repeat){locked=!locked;$('locked').checked=locked;}
});
$('locked').onchange=event=>locked=event.target.checked;
$('toggle').onclick=()=>{$('controls').hidden=!$('controls').hidden;};
$('dodgeFlash').onclick=()=>{useDodgeFlash();renderer.domElement.focus({preventScroll:true});};
ui=new TrainingUI({start:startSession,finish:stopPlaylist,retry:retryShot,reset:resetUserTraining,playlist:startPlaylist,playlistState:()=>playlist,retryPlaylist:()=>playlist&&beginPlaylistBlock(playlist)});
$('startChallenge').onclick=()=>!session||session.state==='finished'?startSession():setChallenge(session.state==='paused');
$('reset').onclick=resetUserTraining;
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
$('pace').oninput=event=>{$('paceValue').textContent=(+event.target.value).toFixed(1).replace('.',',')+' s';};
for(const input of document.querySelectorAll('[data-skill]'))input.onchange=()=>localStorage.setItem(`dodge:${input.dataset.skill}`,input.checked?'1':'0');
for(const input of document.querySelectorAll('[data-skill]'))input.checked=localStorage.getItem(`dodge:${input.dataset.skill}`)!=='0';
for(const [id,apply,format] of [['speed',value=>speed=value,value=>`${value} u/s`],['height',value=>height=value,value=>String(value)],['angle',value=>angle=value,value=>`${value}°`]])$(id).oninput=event=>{const value=+event.target.value;apply(value);$(`${id}Value`).textContent=format(value);};
$('level')?.addEventListener('input',()=>setPlayerAnimation(moving));

function updateCamera(){camera.position.set(focus.x,height,focus.z+height/Math.tan(THREE.MathUtils.degToRad(angle)));camera.lookAt(focus);}
function updateEnemyLabels(){for(const {enemy,label} of enemyLabels){if(!enemy.model||!enemy.group.visible){label.style.display='none';continue;}const projected=enemy.group.position.clone().add(new THREE.Vector3(0,enemy.labelHeight,0)).project(camera);label.textContent=`${enemy.name} · ${enemy.skill.key}`;label.style.display=projected.z<1?'block':'none';label.style.left=(projected.x+1)*innerWidth/2+'px';label.style.top=(-projected.y+1)*innerHeight/2+'px';}}
function updateWarnings(dt){for(let i=warnings.length-1;i>=0;i--){const warning=warnings[i];warning.remaining-=dt;$('incomingTimer').textContent=Math.max(0,warning.remaining).toFixed(1).replace('.',',');if(warning.remaining<=0){warnings.splice(i,1);launchWarning(warning);}}if(!warnings.length)$('incoming').hidden=true;}
function updateProjectiles(dt){
  if(dt<=0)return;
  for(let i=projectiles.length-1;i>=0;i--){
    const projectile=projectiles[i];if(projectile.bornAt===elapsed)continue;
    const previous=projectile.origin.clone().addScaledVector(projectile.direction,projectile.travelled),remaining=projectile.range-projectile.travelled,step=Math.min(remaining,projectile.skill.speed*dt);
    projectile.travelled+=step;
    const point=projectile.origin.clone().addScaledVector(projectile.direction,projectile.travelled);
    projectile.sprite.position.set(point.x,projectile.height,point.z);
    if(projectile.skill.id==='nautilusQ'||projectile.skill.id==='blitzcrankQ')updateNautilusChain(projectile.trail,projectile.origin,projectile.direction,projectile.travelled,projectile.height);
    else if(projectile.trail){projectile.trail.scale.set(1,1,Math.max(1,projectile.travelled));projectile.trail.position.set(projectile.origin.x,4,projectile.origin.z);projectile.trail.rotation.y=Math.atan2(-projectile.direction.x,-projectile.direction.z);}
    const playerEnd=previousPlayerPosition.clone().lerp(position,Math.min(1,step/(projectile.skill.speed*dt)));
    const distance=movingPointDistance(previousPlayerPosition,playerEnd,previous,point),clearance=distance-((projectile.skill.hitWidth??projectile.skill.width)/2+ownGameplayRadius);
    session?.clearance(projectile.shot,clearance);
    if(clearance<=0||projectile.travelled>=projectile.range){
      if(clearance<=0)registerHit(projectile.skill,projectile.shot);else registerDodge(projectile.skill,projectile.shot);
      removeObject(projectile.sprite,!projectile.sharedGeometry);removeObject(projectile.trail);projectiles.splice(i,1);
    }
  }
}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.remaining-=dt;const fade=Math.max(0,effect.remaining/(effect.duration??(effect.kind==='burst'?.5:.28)));for(const entry of effect.materials)entry.material.opacity=entry.opacity*fade;if(effect.kind==='burst')effect.object.scale.setScalar(1+(1-effect.remaining/.5)*1.5);if(effect.remaining<=0){removeObject(effect.object);effects.splice(i,1);}}}

function effectivePlayerSpeed(){return effectiveSpeed(speed*(matchup?.playerSpeedMultiplier??1));}
function processMatchupEvents(){
  for(const e of matchup.drainEvents()){
    const a=e.action;
    if(e.type==='telegraph'){
      const shot=session.beginShot({skill:a.skill,origin:a.origin,endpoint:a.endpoint,direction:a.direction,position,target,velocity:playerVelocity,aimMode:a.aimMode,radius:a.skill.width/2+65});
      shot.missilePath=[];matchupShots.set(a.id,shot);casts++;updateCounters();
    }
    if(e.type==='clearance')session.clearance(matchupShots.get(a.id),e.value);
    if(e.type==='resolve'){
      const shot=matchupShots.get(a.id);if(e.hit)registerHit(a.skill,shot);else registerDodge(a.skill,shot);
    }
    if(e.type==='charm'){target.copy(position);moving=false;}
  }
  for(const p of matchup.projectiles){const shot=matchupShots.get(p.id);if(shot&&!shot.resolved)shot.missilePath.push({...p.position,t:session.time-shot.startedAt});}
}
function updateMatchupHud(){
  if(!matchup)return;const e=matchup;
  $('matchupName').textContent=e.profile.name+' · investida '+e.rounds;
  $('matchupPhase').textContent=e.phase==='waiting'?`Próxima sequência · ${Math.max(0,e.nextRoundAt-e.time).toFixed(1)} s`:e.action?`${e.action.skill.key} · ${Math.max(0,e.action.releaseAt-e.time).toFixed(2)} s`:e.projectiles.some(p=>p.returning)?'Q voltando · acompanhe a Ahri':e.champion==='locke'?`${e.queue.length} Q restante(s) · continue desviando`:'Leia o próximo lançamento';
  $('matchupEffect').textContent=e.charmed?`Encantada · ${(e.charmUntil-e.time).toFixed(1)} s`:e.time<e.slowUntil?`Lentidão ${Math.round(e.slowAmount*100)}% · ${e.nails}/3 pregos`:'Movimento livre';const result=e.summary();$('matchupEffect').textContent+=` · ${result.cleanRounds}/${result.completedRounds} sequências limpas`;
}
function processYoneEvents(){
  for(const e of yone.drainEvents()){
    if(e.type==='telegraph'){
      const a=e.action,shot=session.beginShot({skill:a.skill,origin:a.origin,endpoint:a.endpoint,direction:a.direction,position,target,velocity:playerVelocity,aimMode:a.aimMode,radius:a.skill.width/2+65});
      yoneShots.set(a.id,shot);casts++;updateCounters();
    }
    if(e.type==='resolve'){const shot=yoneShots.get(e.id);session.resolve(shot,e.hit,position);if(e.hit)hits++;else dodged++;yoneShots.delete(e.id);updateCounters();}
    if(e.type==='control'){yone.airborneStartedAt=null;combat.cancel('R-capture');combat.interruptSkills?.();if(combat.champion==='leblanc'){combat.casting=null;combat.dash=null;combat.queued=null;playerAnimator.spell=null;}moving=false;}
    if(e.type==='damage'){
      combat.takeDamage(e.amount);$('hitFlash').textContent=`YONE ${e.kind} · −${e.amount}${e.cc?' · ARREMESSADA':''}`;$('hitFlash').hidden=false;setTimeout(()=>$('hitFlash').hidden=true,500);
      if(e.cc){yone.airborneStartedAt=yone.time;combat.cancel('knockup');combat.interruptSkills?.();if(combat.champion==='leblanc'){combat.casting=null;combat.dash=null;combat.queued=null;playerAnimator.spell=null;}moving=false;}
    }
  }
}
function updateYoneHud(){
  if(!yone)return;
  const remaining=Math.max(0,yone.spiritUntil-yone.time);
  $('yonePhase').textContent=yone.phase==='waiting'?`Próxima investida · ${Math.max(0,yone.nextRoundAt-yone.time).toFixed(1)} s`:yone.phase==='e-return'?'Retornando ao corpo':`E ativo · ${remaining.toFixed(1)} s`;
  $('yoneTempo').textContent=`${yone.attackSpeed.toFixed(3)} ataques/s · Q: ${yone.qCooldown.toFixed(2)} s · ${Math.round(yone.moveSpeed)} u/s`;
  $('yoneStacksLive').textContent=`Q: ${yone.qStacks}/2 cargas · ${yone.qStacks===2?'TORNADO PRONTO':Math.max(0,yone.qReadyAt-yone.time).toFixed(1)+' s'}`;
  if(yone.phase==='r')$('yonePhase').textContent=`R · CONJURANDO ${Math.max(0,yone.action.releaseAt-yone.time).toFixed(2)} s`;
  if(yone.phase.startsWith('q3'))$('yoneStacksLive').textContent='Q3 · TORNADO EM CURSO';
  $('combatObjective').textContent='YONE · SAIA DOS GOLPES E ATAQUE NOS INTERVALOS';
  $('yoneRecord').textContent=`E armazenado: ${Math.round(yone.recordedDamage*.3)} · investidas limpas: ${yone.cleanRounds}/${yone.rounds}`;
  if(yone.time<yone.playerLockedUntil)$('attackState').textContent=Number.isFinite(yone.airborneStartedAt)?'Arremessada · aguarde aterrissar':'Capturada pelo R';
}

function frame(){requestAnimationFrame(frame);const rawDt=Math.min(clock.getDelta(),.05),paused=session&&['paused','finished'].includes(session.state),dt=paused?0:rawDt;elapsed+=dt;
  session?.tick(dt);if(session?.state==='draining'&&!session.drainStarted)finishSession();
  previousPlayerPosition.copy(position);
  if(dt>0){
    moving=combat?combat.update(dt,position,target,speed,{allowStart:session.state==='running'&&!(yone&&yone.time<yone.playerLockedUntil),allowActions:!(yone&&yone.time<yone.playerLockedUntil)}):matchup?.charmed?matchup.moveCharmedPlayer(position,speed,dt):advance(position,target,matchup?effectivePlayerSpeed():speed,dt);
    if(combat){const events=combat.drainEvents();for(const event of events){if(event.type==='blink'){previousPlayerPosition.copy(position);target.copy(position);}if(event.type==='spell'){playerAnimator?.cast?.(event,combat.time);if(model&&!event.returning)model.rotation.y=Math.atan2(event.point.x-position.x,event.point.z-position.z);}if(event.type==='start')playPlayerAttack(event);if(event.type==='empower'&&event.attack)playPlayerAttack(event.attack);if(event.type==='boost')playerAnimator?.boost({time:combat.time,windup:combat.windup});if(event.type==='release')playerAnimator?.release(event.id);if(event.type==='cancel')playerAnimator?.cancel(event.id);if(event.type==='cancel-spell')playerAnimator?.cancelSpell?.();}lane?.observe(events);vault?.observe(events);combatView.events(events);}
    playerVelocity.subVectors(position,previousPlayerPosition).multiplyScalar(1/dt);
    if(session)movementObserver.record(session.time,position);
  }
  if(matchup&&dt>0){matchup.update(dt,position,playerVelocity,{playerBefore:previousPlayerPosition,allowStart:session.state==='running'&&!session.config.rehearsal});processMatchupEvents();session.matchup=matchup.summary();}
  if(lane&&dt>0)lane.update(dt,position);
  if(vault&&dt>0)vault.update(dt,position,{allowStart:session.state==='running'});
  if(yone&&dt>0){yone.update(dt,position,playerVelocity,{playerBefore:previousPlayerPosition,allowStart:session.state==='running'});processYoneEvents();}
  actor.position.copy(position);
  if(yone&&Number.isFinite(yone.airborneStartedAt)&&yone.time<yone.playerLockedUntil){const progress=(yone.time-yone.airborneStartedAt)/Math.max(.001,yone.playerLockedUntil-yone.airborneStartedAt);actor.position.y=90*Math.sin(Math.PI*progress);}
  const facingTarget=combat&&combat.time<combat.animationUntil?combat.target(combat.windup?.targetId??combat.animationTargetId):null;
  if(model&&!combat?.busy&&(moving||facingTarget)){
    const dx=facingTarget?facingTarget.position.x-position.x:position.x-previousPlayerPosition.x,dz=facingTarget?facingTarget.position.z-position.z:position.z-previousPlayerPosition.z;
    const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-model.rotation.y),Math.cos(desired-model.rotation.y));
    const response=facingTarget?4.6/Math.max(.045,combat.profile.windupFraction/combat.attackSpeed):20+14*Math.min(1,Math.abs(delta)/Math.PI);
    model.rotation.y+=delta*(1-Math.exp(-response*dt));
  }
  if(dt>0)setPlayerAnimation(moving,dt);
  if(challengeActive){if(waveEnemies.length){waveRemaining-=dt;const waveComplete=waveEnemies.every(enemy=>enemy.hasCast&&!enemy.group.visible)&&!warnings.length&&!projectiles.length;if(waveComplete||(waveRemaining<=0&&!warnings.length&&!projectiles.length))endWave();}else{waveCooldown-=dt;if(waveCooldown<=0)beginWave();}nextAttack-=dt;if(nextAttack<=0){scheduleAttack();nextAttack=.025;}}
  if(dt>0){for(const enemy of enemies.values())updateEnemyPose(enemy,dt);session?.sample(position);updateWarnings(dt);updateProjectiles(dt);updateEffects(dt);}
  if(combat){
    session.combat=combat.summary(Math.min(session.time,session.attackStoppedAt??session.config.duration));if(yone)session.combat.yone=yone.summary();if(lane)session.combat.lane=lane.summary();if(vault)session.combat.vault=vault.summary();
    if(combat.playerHealth===0&&session.state==='running'){
      if(playlist&&session.config.playlistId===playlist.id){session.playlistKnockouts=(session.playlistKnockouts??0)+1;combat.playerHealth=combat.maxPlayerHealth;$('status').textContent=`● Vida restaurada · ${session.playlistKnockouts} queda(s) neste bloco`;}
      else finishSession();
    }
    const winding=combat.windup,ready=combat.time>=combat.readyAt;
    $('attackState').textContent=paused?'Pausado':winding?'Preparando ataque':ready?'Ataque pronto':'Pode reposicionar';
    if(!paused&&combat.busy)$('attackState').textContent=combat.dash?(combat.champion==='quinn'?'Salto em curso':'Distorção em curso'):'Conjurando habilidade';
    $('attackHud').dataset.phase=winding?'windup':ready?'ready':'cooldown';
    $('attackProgress').value=winding?(combat.time-winding.startedAt)/(winding.releaseAt-winding.startedAt):Math.max(0,1-(combat.readyAt-combat.time)*combat.attackSpeed);
    $('attackHud').querySelector('small').textContent=session.config.bindLeft?'Esquerdo: ataque-movimento · direito: reposicionar':'A + esquerdo: ataque-movimento · direito: reposicionar';
    $('combatObjective').textContent=combat.circuit?`ALVO ${combat.markedId?.split('-').at(-1)} · ${combat.markedProgress}/${combat.markRequired} disparos · ${Math.max(0,combat.markedUntil-combat.time).toFixed(1)} s`:'LIVRE · ataque e dê um passo entre disparos';if(combat.advancedCircuit)$('combatObjective').textContent+=` · ${combat.circuitHint||'passos de '+combat.stepRequired+' u'}`;
    for(const key of ['e','w']){const remaining=Math.max(0,combat[`${key}ReadyAt`]-combat.time);$(`${key}Cooldown`).textContent=key==='e'&&combat.empowered?'Preparado':key==='w'&&combat.speedMultiplier>1?`+30% · ${(combat.boostUntil-combat.time).toFixed(1)} s`:remaining>0?`${remaining.toFixed(1)} s`:'Pronto';$(`cast${key.toUpperCase()}`).disabled=session.state!=='running'||remaining>0;}
    if(combat.castAbility){
      for(const key of ['Q','W','E','R']){const state=combat.abilityState(key),button=$(`lbCast${key}`);button.disabled=session.state!=='running'||!state.ready;button.querySelector('output').textContent=!state.rank?'Não aprendido':state.returning?`${combat.champion==='syndra'?'Arremessar':'Voltar'} · ${state.returnRemaining.toFixed(1)} s`:state.remaining>0?`${state.remaining.toFixed(1)} s`:`Grau ${state.rank} · pronto`;if(combat.champion==='syndra'){if(key==='Q'&&state.rank)button.querySelector('output').textContent=`${state.charges}/${combat.maxQCharges} · ${state.remaining>0?state.remaining.toFixed(1)+' s':'pronto'}`;if(key==='R')button.querySelector('strong').textContent=state.label;}else if(combat.champion==='quinn'&&key==='R')button.querySelector('strong').textContent=state.label;else if(key==='R')button.querySelector('strong').textContent=`Mímica · ${state.returning?'W ↩':combat.lastBasic}`;}
      $('lbMana').textContent=combat.unlimitedMana?'Mana livre · treino':`Mana ${Math.floor(combat.mana)} / ${Math.round(combat.maxMana)}`;
      if(combat.champion==='syndra')$('lbMana').textContent+=` · ${combat.splinters}/120 fragmentos · ${Math.round(combat.abilityPower)} AP`;
      $('lbFeedback').textContent=combat.feedback;
    }
    const c=session.combat;$('combatPerformance').textContent=`${c.apm} APM · ${c.changedApm} comandos distintos/min · passos ${c.kiteSteps}/${c.kiteOpportunities}${combat.circuit?` · ${c.completedMarks} trocas`:''}`;
  }
  if(session?.config.rehearsal&&session.state==='running'&&session.shots.every(s=>s.resolved))finishSession();
  if(session?.state==='draining'&&!warnings.length&&!projectiles.length&&!combat?.pending&&!lane?.pending&&!vault?.pending&&!yone?.pending&&!matchup?.pending)completeSession();
  const flashMode=FLASH_MODES.has(session?.config.drill??ui.drill);$('dodgeFlash').hidden=!flashMode;const flashRemaining=dodgeFlash.remaining(session?.time??0);$('dodgeFlash').disabled=session?.state!=='running'||flashRemaining>0||!!matchup?.charmed;$('flashCooldown').textContent=session?.state==='paused'?'Pausado':flashRemaining>0?flashRemaining.toFixed(1)+' s':'Pronto · 10 s de recarga';
  hudUpdate+=rawDt;if(hudUpdate>.1){ui.update(session);hudUpdate=0;}
  if(locked)focus.copy(position);else if(pointerInside){const edge=.975,edgePanSpeed=1250;if(Math.abs(mouse.x)>edge)focus.x+=Math.sign(mouse.x)*edgePanSpeed*dt;if(Math.abs(mouse.y)>edge)focus.z-=Math.sign(mouse.y)*edgePanSpeed*dt;}
  if(championId==='syndra'&&!combat)combatView.syndraEffects.update(dt,{time:elapsed},position);
  updateCamera();vaultView.update(dt,position,camera);updateVaultHud();laneView.update(dt,camera);updateLaneHud();updateEnemyLabels();combatView.update(dt,position,camera,attackArmed);yoneView.update(dt,position,camera);yoneEffects.update(yone,session?.config.yoneTelegraphs!==false);updateYoneHud();matchupView.update(dt,session?.config.matchupTelegraphs!==false,camera);updateMatchupHud();const label=position.clone().add(new THREE.Vector3(0,260,0)).project(camera);$('champion-label').style.left=(label.x+1)*innerWidth/2+'px';$('champion-label').style.top=(-label.y+1)*innerHeight/2+'px';renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.__trainer={position,target,camera,get playlist(){return playlist;},get enemies(){return [...enemies.values()];},get warnings(){return warnings;},get projectiles(){return projectiles;},get wave(){return {number:waveNumber,remaining:waveRemaining,active:waveEnemies.map(enemy=>enemy.name),aimMode:lastAimMode};},get stats(){return {dodged,hits,casts,challengeActive};},get skills(){return dodgeSkills;},get visualDiagnostics(){return {playerRingHitbox:actor.children.some(child=>child.geometry?.type==='RingGeometry'),warningTargetMarkers:warnings.some(item=>'targetMark'in item),telegraphWidths:warnings.map(item=>item.lane.children[0]?.geometry?.parameters?.width)};},spawn:id=>{const skill=dodgeSkills[id],enemy=[...enemies.values()].find(item=>item.skills.includes(id));if(skill&&enemy){enemy.active=true;enemy.group.visible=true;makeWarning(skill,enemy);}},moveTo:point=>target.copy(point.clone()),get loadedEnemies(){return [...enemies.values()].filter(enemy=>!!enemy.model).map(enemy=>enemy.name);},get enemyAnimations(){return [...enemies.values()].map(enemy=>({name:enemy.name,skinnedMeshes:countSkinnedMeshes(enemy.model),clips:enemy.actions.length,action:enemy.action?.getClip().name,time:enemy.action?.time??0,idleTracks:enemy.idleAction?.getClip().tracks.length,idleDuration:enemy.idleAction?.getClip().duration,idleWeight:enemy.idleAction?.getEffectiveWeight(),idleRunning:enemy.idleAction?.isRunning(),runClip:enemy.runAction?.getClip().name,runTracks:enemy.runAction?.getClip().tracks.length,runWeight:enemy.runAction?.getEffectiveWeight(),moving:enemy.moving,active:enemy.active,dismissWhenCastComplete:!!enemy.dismissWhenCastComplete,hasCast:!!enemy.hasCast,castClip:enemy.castClip?.name,castTracks:enemy.castClip?.tracks.length,castWeight:enemy.castAction?.getEffectiveWeight(),castDuration:enemy.castDuration,casting:enemy.castRemaining>0}));}};

Object.defineProperty(window.__trainer,'session',{get:()=>session});
Object.defineProperties(window.__trainer,{champion:{get:()=>championId},playerYaw:{get:()=>model?.rotation.y},championLoading:{get:()=>championLoading},playerClips:{get:()=>clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))},combat:{get:()=>combat},combatReady:{get:()=>combatView.ready},attackArmed:{get:()=>attackArmed},attackAnimation:{get:()=>playerAnimator?.diagnostics},kayleSpellClips:{get:()=>clips.filter(c=>c.name.includes('spell')).map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))},kaylePose:{get:()=>{const root=model?.getObjectByName('Root');return {root:root?.position.toArray(),finite:model?new THREE.Box3().setFromObject(model).min.toArray().every(Number.isFinite):false};}}});
Object.assign(window.__trainer,{start:startSession,finish:finishSession,retry:retryShot,moveTo:issueMove,attackMove:issueAttackMove,attackTarget:issueAttackTarget});
$('championSelect').onchange=()=>{if(!session||session.state==='finished')selectChampion($('championSelect').value);};
$('playAnimation').onclick=()=>{if(championId==='kayle'||championLoading||(session&&session.state!=='finished'))return;resetChallenge();playerAnimator.previewClip($('animationClip').value,elapsed);};
$('stopAnimation').onclick=()=>{if(!session||session.state==='finished')issueStop();};
$('rotatePreview').onclick=()=>{if(model&&(!session||session.state==='finished'))model.rotation.y+=Math.PI/4;};
Object.assign(window.__trainer,{selectChampion});
Object.defineProperty(window.__trainer,'vault',{get:()=>vault});
selectChampion('kayle');updateCamera();frame();

Object.assign(window.__trainer,{castAbility:(key,point,targetId)=>combat?.castAbility?.(key,point,position,targetId)});

Object.defineProperties(window.__trainer,{yone:{get:()=>yone},yoneReady:{get:()=>yoneView.ready},yoneVisual:{get:()=>yoneView.diagnostics}});

Object.defineProperties(window.__trainer,{matchup:{get:()=>matchup},matchupVisual:{get:()=>matchupView.diagnostics}});

function updateLaneHud(){
  if(!lane)return;const s=lane.summary();
  $('lanePhase').textContent=lane.coach&&lane.action?'JANELA · AUTOATTACK DE FARM':lane.phase==='waiting'?'Adversária reaparece em instantes':'LANE · leia a vida dos minions';
  $('laneWave').textContent=`Onda ${lane.wave} · seu farm ${s.farmLastHits}/${s.farmLastHits+s.farmMissed} · catapultas ${s.siegeSecured}`;
  $('lanePoke').textContent=`Pokes na janela: ${s.timedHits}/${s.timedCasts} · fora: ${s.offWindowHits}/${s.casts-s.timedCasts}`;
  $('laneFeedback').textContent=lane.feedback;
  $('combatObjective').textContent='FARME + POKE NO LAST HIT INIMIGO + RECUE';
}
Object.defineProperties(window.__trainer,{lane:{get:()=>lane},laneVisual:{get:()=>({ready:laneView.ready,clip:laneView.animator?.diagnostics,units:laneView.units.size})}});

function updateVaultHud(){
  if(!vault)return;
  const s=vault.summary();
  $('vaultPhase').textContent=({waiting:'Próxima aparição…',prepare:'Observe a LeBlanc',dash:'W em curso',interrupted:'W INTERROMPIDO',recovery:'Tentativa concluída'})[vault.phase];
  $('vaultScore').textContent=`${s.interrupted}/${s.attempts} interrupções · ${s.held}/${s.patienceTrials} E guardados`;
  $('vaultFeedback').textContent=vault.feedback;
  $('combatObjective').textContent='E NO ALVO · INTERROMPA O AVANÇO DO W';
}
Object.defineProperty(window.__trainer,'vaultVisual',{get:()=>vaultView.diagnostics});

Object.defineProperty(window.__trainer,'flash',{get:()=>({uses:dodgeFlash.uses,remaining:dodgeFlash.remaining(session?.time??0),range:dodgeFlash.range})});
