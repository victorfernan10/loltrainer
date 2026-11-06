import {XerathAnimator} from './xerath-animation.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KayleAnimator} from './kayle-animation.js';
import {LeBlancAnimator} from './leblanc-animation.js';
import {QuinnAnimator} from './quinn-animation.js';
import {SyndraAnimator} from './syndra-animation.js';

const cache=new Map();
const texture=async path=>{const map=await new THREE.TextureLoader().loadAsync(path);map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;return map;};
export function loadPlayerModel(id){
  if(!cache.has(id))cache.set(id,load(id).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}
async function load(id){
  const loader=new GLTFLoader();let gltf,clips,maps;
  if(id==='xerath'){
    [gltf,...maps]=await Promise.all([loader.loadAsync('/assets/xerath/xerath.glb'),texture('/assets/xerath/xerath_base_tx_cm.png')]);clips=gltf.animations;
  }else if(id==='quinn'){
    [gltf,...maps]=await Promise.all([loader.loadAsync('/assets/quinn/quinn.glb'),texture('/assets/quinn/quinn_base_tx_cm.png')]);clips=gltf.animations;
  }else if(id==='syndra'){
    [gltf,...maps]=await Promise.all([loader.loadAsync('/assets/syndra/syndra.glb'),texture('/assets/syndra/syndra_base_tx_cm.png')]);clips=gltf.animations;
  }else if(id==='leblanc'){
    [gltf,...maps]=await Promise.all([loader.loadAsync('/assets/leblanc/leblanc.glb'),texture('/assets/leblanc/leblanc_base_tx_cm.png'),texture('/assets/leblanc/leblanc_base_weapon_tx_cm.png')]);clips=gltf.animations;
  }else{
    const names=['kayle_base_tx_cm','kayle_base_lvl11_tx_cm','kayle_base_wings_tx_cm','kayle_base_sword_tx_cm'];
    const [base,spells,...textures]=await Promise.all([loader.loadAsync('/assets/kayle.glb'),loader.loadAsync('/assets/kayle-spells.glb'),...names.map(n=>texture(`/assets/${n}.png`))]);
    gltf=base;clips=[...base.animations,...spells.animations];maps=Object.fromEntries(names.map((n,i)=>[n,textures[i]]));
  }
  const model=gltf.scene;model.scale.setScalar(id==='xerath'?1.7:id==='quinn'?1.3:id==='kayle'?1.175:id==='syndra'?1.25:1);
  model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.frustumCulled=false;const name=o.material.name.toLowerCase();
    o.material.map=(id==='syndra'||id==='quinn'||id==='xerath')?maps[0]:id==='leblanc'?maps[name==='weapon'||name==='cape'?1:0]:maps[name.includes('wings')?'kayle_base_wings_tx_cm':name.includes('sword')?'kayle_base_sword_tx_cm':name==='level11'?'kayle_base_lvl11_tx_cm':'kayle_base_tx_cm'];
    if(id==='xerath'){o.material.vertexColors=false;if(o.material.emissive){o.material.emissive.set('#376f95');o.material.emissiveMap=maps[0];o.material.emissiveIntensity=.5;}}
    o.material.side=THREE.DoubleSide;o.material.transparent=false;o.material.alphaTest=name==='kayle_base_body_mat'?0:.05;o.material.depthWrite=true;o.material.needsUpdate=true;
  });
  const animator=id==='xerath'?new XerathAnimator(model,clips):id==='quinn'?new QuinnAnimator(model,clips):id==='syndra'?new SyndraAnimator(model,clips):id==='leblanc'?new LeBlancAnimator(model,clips):new KayleAnimator(model,clips);
  if(id==='quinn'){
    const [valor,map]=await Promise.all([loader.loadAsync('/assets/quinn/valor.glb'),texture('/assets/quinn/quinnvalor_base_tx_cm.png')]);
    valor.scene.traverse(o=>{if(o.isMesh){o.material.map=map;o.material.side=THREE.DoubleSide;o.material.alphaTest=.05;o.frustumCulled=false;o.castShadow=true;}});
    animator.attachValor(valor.scene,valor.animations);
  }
  return {model,clips,animator};
}
