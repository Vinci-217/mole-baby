// Automatic peeks are infrequent; pointer hover is handled separately.
function edgeDelay(pose,random=Math.random()) {
  const value=Number.isFinite(random)?Math.max(0,Math.min(1,random)):0.5;
  return pose==='visible'?1600:pose==='peek'?4500+Math.round(value*2500):120000+Math.round(value*180000);
}
module.exports={edgeDelay};
