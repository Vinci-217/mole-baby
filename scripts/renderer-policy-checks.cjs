const assert=require('node:assert/strict');
/** A functional CSP probe: an external script must never reach the network. */
async function verifyRendererPolicy(page){
 const policy=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
 assert.ok(policy.includes("script-src 'self'"));assert.ok(!policy.includes('unsafe-eval'));
 let requested=0;await page.route('https://example.invalid/renderer-policy-probe.js',route=>{requested++;return route.abort()});
 try{
  const directive=await page.evaluate(()=>new Promise((resolve,reject)=>{
   let node;const done=event=>{if(event.blockedURI!=='https://example.invalid/renderer-policy-probe.js')return;clearTimeout(timer);document.removeEventListener('securitypolicyviolation',done);node.remove();resolve(event.effectiveDirective)};
   document.addEventListener('securitypolicyviolation',done);
   const timer=setTimeout(()=>{document.removeEventListener('securitypolicyviolation',done);node?.remove();reject(Error('No renderer policy violation received'))},5000);
   node=document.createElement('script');node.src='https://example.invalid/renderer-policy-probe.js';document.head.append(node);
  }));
  assert.match(directive,/^script-src/);assert.equal(requested,0,'external renderer scripts must be blocked before any request');
 }finally{await page.unroute('https://example.invalid/renderer-policy-probe.js')}
 console.log('PASS local renderer policy: external scripts blocked before network access');
}
module.exports={verifyRendererPolicy};
