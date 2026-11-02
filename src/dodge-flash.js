export const FLASH_MODES=new Set(['precision','rhythm','pressure','ahri','locke']);
export class DodgeFlash {
  constructor(){this.range=400;this.cooldown=10;this.readyAt=0;this.uses=0;}
  remaining(time){return Math.max(0,this.readyAt-time);}
  cast(time,position,aim){
    if(this.remaining(time)>1e-8||![time,position.x,position.z,aim.x,aim.z].every(Number.isFinite))return null;
    const dx=aim.x-position.x,dz=aim.z-position.z,distance=Math.hypot(dx,dz);if(distance<1e-6)return null;
    const scale=Math.min(1,this.range/distance);this.readyAt=time+this.cooldown;this.uses++;
    return {from:{x:position.x,z:position.z},to:{x:position.x+dx*scale,z:position.z+dz*scale}};
  }
}
