// Pointer Lock hides the OS cursor and provides relative motion. Keep a visible
// screen cursor so movement, aiming and camera edges still use the same point.
export class CapturedPointer {
  constructor({canvas,button,cursor,mouse,onMove,onEscape,onError,canCapture}){
    Object.assign(this,{canvas,button,cursor,mouse,onMove,onEscape,onError,canCapture});
    this.active=false;this.pending=false;this.releasing=false;this.lastUnlock=-Infinity;
    button.onclick=()=>this.request();
    document.addEventListener('pointerlockchange',()=>{
      const wasActive=this.active;this.active=document.pointerLockElement===canvas;this.pending=false;
      cursor.toggleAttribute('hidden',!this.active);button.textContent=this.active?'Mouse preso · Esc libera':'Prender mouse';button.setAttribute('aria-pressed',String(this.active));
      if(this.active){if(!canCapture()){this.release();return;}canvas.focus({preventScroll:true});this.paint();onMove();}
      else if(wasActive){this.lastUnlock=performance.now();if(!this.releasing)onEscape();}
      this.releasing=false;
    });
    document.addEventListener('pointerlockerror',()=>this.failed());
    document.addEventListener('mousemove',event=>{
      if(!this.active)return;
      this.mouse.x=Math.max(-1+2/innerWidth,Math.min(1-2/innerWidth,this.mouse.x+event.movementX*2/innerWidth));
      this.mouse.y=Math.max(-1+2/innerHeight,Math.min(1-2/innerHeight,this.mouse.y-event.movementY*2/innerHeight));
      this.paint();onMove();
    });
    window.addEventListener('resize',()=>{if(this.active)this.paint();});
  }
  async request(){
    if(!this.canCapture()||this.pending||this.active)return;
    if(!this.canvas.requestPointerLock){this.failed();return;}
    this.pending=true;
    try{await this.canvas.requestPointerLock();}catch{this.failed();}
  }
  failed(){this.pending=false;this.onError('Não foi possível prender o mouse neste navegador. Abra o site no Chrome ou Edge e tente novamente.');}
  release(){if(this.active){this.releasing=true;document.exitPointerLock();}}
  handlesEscape(){return this.active||performance.now()-this.lastUnlock<250;}
  paint(){this.cursor.style.left=`${(this.mouse.x+1)*innerWidth/2}px`;this.cursor.style.top=`${(1-this.mouse.y)*innerHeight/2}px`;}
}
