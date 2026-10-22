// Automatic peeks are infrequent; pointer hover is handled separately.
function edgeDelay(pose,random=Math.random()) {
  const value=Number.isFinite(random)?Math.max(0,Math.min(1,random)):0.5;
  return pose==='tucking'?1800:pose==='visible'?450:pose==='peek'?4500+Math.round(value*2500):120000+Math.round(value*180000);
}
module.exports={edgeDelay};
