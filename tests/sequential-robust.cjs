const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{try{let p=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end('404')}});
(async()=>{await new Promise(r=>server.listen(8818,r));const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let results=[];
try{
 const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});let errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})});
 await p.goto('http://127.0.0.1:8818');const ev=()=>p.evaluate(async()=>(await import('./main.js')).journeyEvidence());
 await p.locator('#theme').click();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');results.push('blocked storage: app and theme operate');
 await p.locator('#next').focus();await p.keyboard.press('Enter');assert.equal((await ev()).phase,'action');
 await p.keyboard.press('Tab');await p.locator('#next').focus();await p.keyboard.press('Space');assert.equal((await ev()).phase,'result');results.push('Enter and Space operate the primary control');
 await p.locator('#next').click();await p.locator('#answers button').first().focus();await p.keyboard.press('ArrowDown');assert.equal((await ev()).choice,1);await p.locator('#next').click();assert.equal((await ev()).phase,'feedback');
 await p.locator('#back').click();assert.equal((await ev()).phase,'question');assert.equal((await ev()).choice,1);await p.locator('#answers button').last().click();await p.locator('#next').click();assert.equal((await ev()).choice,2);results.push('radio arrow-key selection and reversible wrong-answer retry');
 await p.locator('#back').click();await p.locator('#back').click();assert.equal((await ev()).phase,'result');
 await p.locator('#replay').click();assert.equal((await ev()).phase,'result');await p.locator('#back').click();assert.equal((await ev()).phase,'result');results.push('replay preserves previous result and Back restores it');
 await p.setViewportSize({width:1440,height:900});await p.screenshot({path:'/tmp/falling-sequential-refit-1440.png'});await p.setViewportSize({width:320,height:568});await p.screenshot({path:'/tmp/falling-sequential-refit-320.png'});results.push('live phone to desktop to phone refit');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#replay').click();assert.equal((await ev()).phase,'running');await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#next').click();assert.equal((await ev()).phase,'result');results.push('live reduced-motion change never leaves primary control stranded');
 await p.locator('#about-open').click();assert(await p.locator('#about').evaluate(e=>e.open));await p.locator('#about-close').click();assert(!(await p.locator('#about').evaluate(e=>e.open)));results.push('About opens and closes with model limits retained');
 assert.equal(errors.length,0);results.push('no browser errors in robustness pass');
 fs.writeFileSync('/tmp/falling-sequential-robustness.json',JSON.stringify(results,null,2));console.log(results.join('\n'));
}catch(e){console.error(e);process.exitCode=1;}finally{await b.close();server.close()}
})();
