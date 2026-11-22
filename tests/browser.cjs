// Real Chromium phase-walk for the single-control player.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..'),out=process.env.OUT || '/tmp/falling-sequential-qa';fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('Not found');}});
const assert=require('assert/strict');
(async()=>{await new Promise(r=>server.listen(8817,r));const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let report=[];
try{
for(const [w,h,theme,motion] of [[320,568,'light','reduce'],[390,844,'light','no-preference'],[1280,800,'light','reduce'],[1440,900,'dark','reduce'],[1280,800,'dark','reduce'],[1440,900,'light','reduce'],[320,568,'dark','reduce'],[390,844,'dark','reduce']]){
const p=await b.newPage({viewport:{width:w,height:h},reducedMotion:motion});let errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8817'))requests.push(r.url())});
await p.goto('http://127.0.0.1:8817/');await p.waitForFunction(()=>document.body.dataset.phase);
if(theme==='dark')await p.locator('#theme').click();
const key=`${w}-${theme}`;let phases=[],issues=[];let count=0;
while(count++<75){
 const e=await p.evaluate(async()=> (await import('./main.js')).journeyEvidence());phases.push([e.stepId,e.phase]);
 const audit=await p.evaluate(()=>{
  const visible=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
  const buttons=[...document.querySelectorAll('button')].filter(visible);
  const tiny=buttons.filter(e=>{const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(e=>e.id||e.textContent);
  const small=[...document.querySelectorAll('h1,p,button')].filter(visible).filter(e=>parseFloat(getComputedStyle(e).fontSize)<14).map(e=>e.id);
  const outside=buttons.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.top<-.5}).map(e=>e.id||e.textContent);
  const content=document.querySelector('#guide-content'); const next=document.querySelector('#next').getBoundingClientRect();const r=content.getBoundingClientRect();
  return {tiny,small,outside,scroll:document.documentElement.scrollHeight>innerHeight+1,contentOver:r.bottom>next.top-8,next:{x:next.x,y:next.y,w:next.width,h:next.height}};
 });
 if(audit.tiny.length||audit.small.length||audit.outside.length||audit.scroll||audit.contentOver)issues.push({step:e.stepId,phase:e.phase,...audit});
 if(['cover','question','feedback','result','done'].includes(e.phase))await p.screenshot({path:`${out}/${key}-${String(e.step).padStart(2,'0')}-${e.phase}${e.action?'-'+e.action:''}.png`});
 if(e.phase==='done')break;
 if(e.phase==='question'){
  // Selecting never submits, and Next never chooses an answer itself.
  await p.locator('#next').click();assert.equal((await p.evaluate(async()=> (await import('./main.js')).journeyEvidence())).phase,'question');
  await p.locator('#answers button').nth(e.step%3).click();
  assert.equal((await p.evaluate(async()=> (await import('./main.js')).journeyEvidence())).phase,'question');
 }
 await p.locator('#next').click();
 if(e.phase==='action'||(e.phase==='result'&&e.stepId==='throw'&&e.action===0)||e.phase==='feedback'&&e.stepId==='transfer'){
   if(motion==='no-preference'){if(e.step<4) await p.waitForFunction(()=>document.body.dataset.phase==='result',null,{timeout:14000}); else await p.locator('#next').click();}
 }
}
assert(count<75);assert.equal(errors.length,0,errors.join());assert.equal(requests.length,0);
report.push({key,motion,phases,issues,errors,externalRequests:requests});console.log(key,'phases',phases.length,'issues',issues.length);
// Reversible phases, confirmation cancellation, reset and no stuck button.
await p.locator('#back').click();assert.equal((await p.evaluate(async()=> (await import('./main.js')).journeyEvidence())).phase,'explain');
await p.locator('#reset').click();await p.locator('#reset-cancel').click();assert.equal((await p.evaluate(async()=> (await import('./main.js')).journeyEvidence())).phase,'explain');
await p.locator('#reset').click();await p.locator('#reset-yes').click();assert.equal((await p.evaluate(async()=> (await import('./main.js')).journeyEvidence())).phase,'cover');
await p.close();
}
fs.writeFileSync(out+'/audit.json',JSON.stringify(report,null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{await b.close();server.close();}
})();
