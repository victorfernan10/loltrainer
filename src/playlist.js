// Explicit teaching order; every drill is played exactly once.
export const PLAYLIST_MODES=Object.freeze(['precision','rhythm','pressure','combat','yone','ahri','locke','vault','lane','aim']);
export class TrainingPlaylist {
  constructor(base,{duration=60,difficulty=2}={}){
    if(![60,90,120].includes(duration)||![1,2,3].includes(difficulty))throw new Error('Escolha uma duração e dificuldade válidas.');
    this.base={...base,skills:[...base.skills]};this.duration=duration;this.difficulty=difficulty;
    this.id=crypto.randomUUID();this.index=0;this.reports=[];this.loading=false;this.error=null;this.stopping=false;
  }
  get total(){return PLAYLIST_MODES.length;}
  get mode(){return PLAYLIST_MODES[this.index];}
  config(){
    if(!this.mode)return null;
    return {...this.base,skills:[...this.base.skills],drill:this.mode,duration:this.duration,difficulty:this.difficulty,
      playlistId:this.id,playlistIndex:this.index,rehearsal:false,seed:((this.base.seed??0)+this.index)>>>0,
      ...(this.mode==='combat'?{combatHazards:true,combatCircuit:'on'}:{}),
      ...(this.mode==='aim'?{champion:'xerath',speed:340,level:Math.max(6,this.base.level)}:{}),
      ...(this.mode==='vault'?{champion:'quinn',speed:330,level:Math.max(6,this.base.level)}:{})};
  }
  complete(report){
    if(report.config.playlistId!==this.id||report.config.playlistIndex!==this.index||report.config.drill!==this.mode)return false;
    this.reports.push(report);this.index++;
    return !this.stopping&&this.index<this.total;
  }
}
