import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from '../tests/fixtures/legacy-simulation.js';
const out=process.env.AW_OUTPUT||'playtest-output/round49-teaching-timing';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=JSON.stringify;
const report={startedAt:new Date().toISOString(),scope:'Iteration49 rebuild, newly executed public UI timing/conditional coverage checks. Not byte-identical recovery or universal balance certification.',checks:[],screenshots:[],metrics:[],coverageCases:[],errors:[]};
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
async function hash(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hash();
function next(api,s,tasks=[]){for(const [actor,cell,id]of tasks){const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a,id);for(const e of a.requireEvidence)if(api.investigate&&!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);api.lockTask(s,actor,cell,id,a.requireEvidence);}for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function scenario(api,year,school=false){const s=api.createRun(0);next(api,s);if(year>=20)next(api,s,school?[['protagonist','E4','fund_school']]:[]);if(year===30)next(api,s);return s;}
let server,browser,page;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4849,strictPort:true}});await server.listen();browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(`${r.url()} ${r.failure()?.errorText}`));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4849');await page.locator('.selection-card').waitFor();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 async function exact(s,label){const got=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label+' complete world and autosave unchanged',got.world===json(s)&&got.save===json(s));}
 async function afterMutation(s,label){
  const expected=json(s),probe=await page.evaluate(w=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return {live:JSON.stringify(a.state)===w,durable:!!raw&&JSON.stringify(JSON.parse(raw).state)===w,pending:a.storage.pending,error:a.storage.lastError,conflicted:a.storage.conflicted};},expected);
  check(label+' immediate world equals independent model and write is durable or pending',probe.live&&!probe.error&&!probe.conflicted&&(probe.durable||probe.pending>0),probe);
  await page.waitForFunction(w=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return !!raw&&!a.storage.pending&&!a.storage.lastError&&!a.storage.conflicted&&JSON.stringify(a.state)===w&&JSON.stringify(JSON.parse(raw).state)===w;},expected);await exact(s,label);
 }
 async function load(s,big,label){await click('settings');await page.locator('#import-save').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))});await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:15000});await exact(s,label+' real import');}
 async function scene(){await click('home');await click('list');await page.locator('[data-action="select"][data-cell="E4"]').click();await page.locator('[data-primary-action]').click();}
 async function layout(loc,big,label){const m=await loc.evaluate(e=>({width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,overflow:[e,...e.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&(r.left<-.6||r.right>innerWidth+.6);}).map(n=>n.tagName+'.'+n.className),clipped:[e,...e.querySelectorAll('p,span,li')].filter(n=>{const c=getComputedStyle(n);return ['hidden','clip'].includes(c.overflowY)&&n.scrollHeight>n.clientHeight+1;}).map(n=>n.className)}));report.metrics.push({label,...m});check(label+' full size text without overflow/clipping',m.font===(big?'32px':'16px')&&m.scroll<=m.width&&!m.overflow.length&&!m.clipped.length,m);}
 async function coverageComparison(s,loc,mode,label){
  const legacyModel=sim.usesLegacyCrisisRules(s),block=loc.locator('[data-teaching-coverage]');
  if(legacyModel){
   check(label+' legacy has no regional comparison or decimal coefficient',await block.count()===0&&await loc.locator('[data-teaching-current],[data-teaching-conditional],[data-teaching-delta]').count()===0&&!/\b0\.\d+\b/.test(await loc.innerText()));
   return;
  }
  if(mode!=='contract')return;
  const current=sim.getWarningCoverage(s).E4.coverage,conditional=Math.max(current,sim.COVERAGE_RULES.localTeaching),delta=Number((conditional-current).toFixed(4));
  check(label+' exactly one visible native comparison',await block.count()===1&&await block.isVisible());
  const rows=[['current',current,'当前实际覆盖系数：'],['conditional',conditional,'此假设下当地覆盖系数：'],['delta',delta,'此假设下新增覆盖系数：']];
  const observed={};
  for(const [kind,value,labelText] of rows){
   const row=block.locator(`[data-teaching-${kind}]`),text=await row.innerText(),numbers=text.match(/[+-]?\d+(?:\.\d+)?/g)||[];
   observed[kind]=text;
   check(label+' '+kind+' is a visible independent row with exact public arithmetic',await row.count()===1&&await row.isVisible()&&text.startsWith(labelText)&&numbers.length===1&&Number(numbers[0])===Number(value.toFixed(4)),{expected:value,text});
  }
  const text=await block.innerText();
  const assumptions=block.locator('[data-teaching-assumptions]');
  check(label+' conditional assumption remains directly visible before after-value',await assumptions.count()===1&&await assumptions.isVisible()&&/其他载体保持现状/.test(text)&&/按合同兑现/.test(text)&&/足额维护/.test(text)&&await assumptions.evaluate(e=>{const next=e.parentElement.querySelector('[data-teaching-conditional]');return !!(e.compareDocumentPosition(next)&Node.DOCUMENT_POSITION_FOLLOWING)&&e.getBoundingClientRect().bottom<=next.getBoundingClientRect().top;}));
  check(label+' actual value, assumed after-value and difference retain reading order',await block.evaluate(e=>{const a=e.querySelector('[data-teaching-current]'),b=e.querySelector('[data-teaching-conditional]'),c=e.querySelector('[data-teaching-delta]');return !!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(b.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING)&&a.getBoundingClientRect().bottom<=b.getBoundingClientRect().top&&b.getBoundingClientRect().bottom<=c.getBoundingClientRect().top;}));
  check(label+' no additive or probability interpretation',/取最高|最高值|取较大值/.test(text)&&/不叠加|不相加/.test(text)&&/不是人口比例/.test(text)&&/伤亡比例/.test(text)&&/成功概率/.test(text));
  const zero=block.locator('[data-teaching-zero-increase]');
  if(delta===0)check(label+' zero delta does not erase original contract benefits',await zero.count()===1&&await zero.isVisible()&&/当地覆盖不增加/.test(await zero.innerText())&&/不代表没有其他合同收益/.test(await zero.innerText()));
  else check(label+' positive delta is not labeled as no increase',await zero.count()===0);
  if(s.year===30){const history=block.locator('[data-teaching-history-boundary]');check(label+' later-service limit precedes comparison values',await history.count()===1&&await history.isVisible()&&text.indexOf('仅说明后续服务')>=0&&text.indexOf('不改第23年记录')>=0&&text.indexOf('不改第23年记录')<text.indexOf(observed.current)&&await history.evaluate(e=>{const current=e.parentElement.querySelector('[data-teaching-current]');return !!(e.compareDocumentPosition(current)&Node.DOCUMENT_POSITION_FOLLOWING)&&e.getBoundingClientRect().bottom<=current.getBoundingClientRect().top;}));}
  report.coverageCases.push({label,year:s.year,current,conditional,delta,observed});
 }
 async function context(s,id,mode,label){const loc=page.locator(`[data-teaching-timing][data-teaching-mode="${mode}"]`);check(label+' exactly one context',await loc.count()===1);check(label+' action/year/model matches actual world',await loc.getAttribute('data-teaching-action')===id&&await loc.getAttribute('data-teaching-year')===String(s.year)&&await loc.getAttribute('data-teaching-model')===(sim.usesLegacyCrisisRules(s)?'legacy-overall':'regional'));const text=await loc.innerText();check(label+' due year and crisis year stated',text.includes(String(s.year+1))&&text.includes('23'));if(sim.usesLegacyCrisisRules(s))check(label+' old overall rules have no regional coefficient promise',!text.includes('0.55')&&/旧|整体/.test(text));else if(mode==='contract')check(label+' conditional coverage retains maintenance and max-not-sum boundary',text.includes('0.55')&&/维护/.test(text)&&/不叠加|取最高|最高值|取较大值|不相加/.test(text));if(s.year===30)check(label+' no retroactive rescue claim',/不.*第\s*23\s*年|第\s*23\s*年.*不|不回写旧损失|不能降低已经记下/.test(text));await coverageComparison(s,loc,mode,label);await exact(s,label);return loc;}
 for(const [producer,api]of [['current',sim],['old-workload',old],['legacy-overall',legacy]])for(const [year,school]of [[10,false],[20,false],[20,true],[30,true]])for(const [width,big]of [[390,false],[320,true]]){
  const s=scenario(api,year,school),id=year===10?'fund_school':'train_network',label=`${producer}-${year}-${school?'existing':'new'}-${width}-${big?200:100}`;
  await page.setViewportSize({width,height:width===320?568:844});await load(s,big,label);await scene();const card=page.locator(`.choice-card[data-id="${id}"]`);await card.scrollIntoViewIfNeeded();await context(s,id,'card',label+' card');await layout(card,big,label+' card');const original=sim.getActions(s,'E4','protagonist').find(a=>a.id===id);check(label+' original card description retained',(await card.innerText()).includes(original.description));
  await card.focus();await page.keyboard.press('Enter');await page.locator('[data-decision-stage="preview"]').waitFor();let loc=await context(s,id,'contract',label+' preview');await layout(page.locator('.decision-page'),big,label+' preview');
  check(label+' four original contract fields stay intact',await page.locator('[data-contract-core] > div').count()===4&&(await page.locator('[data-contract-core]').innerText()).includes(original.risk)&&(await page.locator('[data-contract-core]').innerText()).includes(original.reward));
  check(label+' timing follows original core',await loc.evaluate(e=>{const core=document.querySelector('[data-contract-core]');return !!(core.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)&&e.getBoundingClientRect().top>=core.getBoundingClientRect().bottom;}));
  if(producer==='current'&&year===20||producer==='legacy-overall'&&year===30&&!big){await loc.scrollIntoViewIfNeeded();const path=`${out}/${label}.png`;await page.screenshot({path,fullPage:true});report.screenshots.push({path,sha256:sha(await fs.readFile(path)),kind:'original Chromium full-page screenshot'});}
  await page.waitForLoadState('networkidle',{timeout:12000});await page.reload();await page.locator('[data-decision-stage="preview"]').waitFor();await context(s,id,'contract',label+' refresh');
  await click('confirm');await page.locator('[data-decision-stage="confirm"]').waitFor();await context(s,id,'contract',label+' confirm');await layout(page.locator('.decision-page'),big,label+' confirm');await page.locator('[data-action="choose"]').first().dblclick();await page.locator('[data-decision-stage="preview"]').waitFor();await context(s,id,'contract',label+' repeated back');check(label+' repeated back keeps heading focus',await page.evaluate(()=>document.activeElement===document.querySelector('main h1')));
  await page.locator('[data-resume-contract]').click();await context(s,id,'card',label+' resume');check(label+' resumes exact original card focus',await card.evaluate(e=>document.activeElement===e));
 }
 const pair=sim.createRun(0);next(sim,pair);next(sim,pair,[['protagonist','D4','recruit_volunteer']]);await page.setViewportSize({width:320,height:568});await load(pair,true,'companion');await click('home');await page.locator('[data-action="actor"][data-actor="linche"]').click();await scene();await context(pair,'train_network','card','companion card');await page.locator('.choice-card[data-id="train_network"]').click();await context(pair,'train_network','contract','companion preview');check('companion retains selected actor',await page.evaluate(()=>window.afterwave.ui.actor==='linche'));await click('confirm');await context(pair,'train_network','contract','companion confirm');await layout(page.locator('.decision-page'),true,'companion confirm');
 const s=scenario(sim,20);await page.setViewportSize({width:390,height:844});await load(s,false,'natural-settlement');await scene();await page.locator('.choice-card[data-id="train_network"]').click();await click('confirm');await click('lock');sim.lockTask(s,'protagonist','E4','train_network',[]);await afterMutation(s,'real lock no payment');await click('commit');sim.commitWindow(s);await afterMutation(s,'real atomic submission');for(let y=21;y<=23;y++){await click('step');sim.advanceYear(s);await afterMutation(s,`actual year${y}`);}check('actual year21 school exists with correct source',s.institutions.some(i=>i.kind==='school'&&i.cellId==='E4'&&i.startYear===21));check('actual year23 crisis occurred with E4 coverage .55',sim.getWarningCoverage(s).E4.coverage===.55&&s.history.some(h=>h.year===23));
 check('natural year20 scenarios exercised both added and zero coverage',report.coverageCases.some(c=>c.year===20&&c.current===0&&c.conditional===.55&&c.delta===.55)&&report.coverageCases.some(c=>c.year===20&&c.current===.55&&c.conditional===.55&&c.delta===0));
 check('no page or network errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.inputsAfter=await hash();check('source/tests/scripts unchanged',report.inputsBefore===report.inputsAfter);report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failure:report.failure||null}));
}
