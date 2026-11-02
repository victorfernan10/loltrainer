// AI policy is a training design, separate from shipped spell/movement data.
export const TRAINING_RULESET=6;
export function trainingConfig(config){
  const advanced=config.trainingProfile==='advanced';
  return {...config,trainingProfile:advanced?'advanced':'assisted',trainingRuleset:TRAINING_RULESET,
    ...(advanced?{laneCoach:false,matchupTelegraphs:false,yoneTelegraphs:false,unlimitedMana:false}:{})};
}

// Observe movement already simulated, never the player's cursor or destination.
export class MovementObserver {
  constructor(){this.samples=[];}
  record(time,position){
    if(this.samples.at(-1)?.time===time)return;
    this.samples.push({time,x:position.x,z:position.z});
    while(this.samples.length>2&&this.samples[1].time<time-1)this.samples.shift();
  }
  aim(time,origin,skill,{reaction=.12,lead=true,strength=1}={}){
    const seen=this.samples.filter(s=>s.time<=time-reaction);
    const last=seen.at(-1)??this.samples[0];if(!last)return null;
    const first=seen.find(s=>s.time>=last.time-.12)??last,dt=last.time-first.time;
    let vx=dt>.015?(last.x-first.x)/dt:0,vz=dt>.015?(last.z-first.z)/dt:0;
    // Blinks/dashes must not create kilometre-long velocity extrapolations.
    const speed=Math.hypot(vx,vz);if(speed>600){vx=0;vz=0;}
    const flight=Number.isFinite(skill.speed)?Math.hypot(origin.x-last.x,origin.z-last.z)/skill.speed:0;
    const horizon=lead?Math.min(.85,reaction+skill.warning+flight)*strength:0;
    const scale=Math.min(1,320/(Math.hypot(vx,vz)*horizon||1));
    return {x:last.x+vx*horizon*scale,z:last.z+vz*horizon*scale};
  }
}

export function engagementPlan(random,difficulty,advanced){
  if(!advanced)return {distance:620,delay:0,side:0};
  const near={1:560,2:460,3:390}[difficulty]??460;
  return {distance:near+random()*280,delay:.12+random()*.4,side:random()<.5?-1:1};
}
