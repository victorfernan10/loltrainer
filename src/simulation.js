export function advance(position, target, speed, dt) {
  const dx=target.x-position.x, dz=target.z-position.z, distance=Math.hypot(dx,dz);
  if(distance<0.001) return false;
  const step=Math.min(distance,speed*dt);
  position.x+=dx/distance*step; position.z+=dz/distance*step;
  return true;
}
export function effectiveSpeed(raw) {
  if(raw>490) return raw*0.5+230;
  if(raw>415) return raw*0.8+83;
  if(raw<220) return raw*0.5+110;
  return raw;
}
