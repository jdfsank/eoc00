import {importAndWaitForSave} from './helpers/import-receipt.mjs';
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import {localCostNumber} from '../src/local-cost-ledger.js';
import {getEndingRecollection} from '../src/ending-recollection.js';
const out=process.env.AW_OUTPUT||'playtest-output/round43-local-ruler';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=JSON.stringify;
const report={scope:'Fixed-scale local cost ruler and a separately preserved round42 actual-UI year40 save. This does NOT restore the lost optional round27 historical fixture.',checks:[],screenshots:[],errors:[]};
async function hashInputs(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hashInputs();
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
const fixturePath='tests/fixtures/round42-current-ui-year40.json',fixture=await fs.readFile(fixturePath),saved=JSON.parse(fixture),provenance=JSON.parse(await fs.readFile('tests/fixtures/round42-current-ui-year40.provenance.json'));
check('preserved round42 actual UI fixture bytes match provenance',sha(fixture)===provenance.sha256);
check('fixture is genuinely at ended year40',saved.state.year===40&&saved.state.phase==='ended');
report.fixture={path:fixturePath,sha256:sha(fixture),origin:provenance.origin};
let server,browser,page;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4843,strictPort:true}});await server.listen();
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4843');await page.locator('.selection-card').waitFor();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 async function exact(s,label){const actual=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label+' exact world and autosave',actual.world===json(s)&&actual.save===json(s));}
 async function load(s,big,label){await click('settings');await importAndWaitForSave(page,{name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))},{state:s,bigText:big});await exact(s,label+' import');}
 async function inspect(loc,big,label){const m=await loc.evaluate(e=>({font:getComputedStyle(document.documentElement).fontSize,width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[e,...e.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&(r.left<-.6||r.right>innerWidth+.6);}).map(n=>n.className),clipped:[e,...e.querySelectorAll('p,h2,h3,h4')].filter(n=>{const c=getComputedStyle(n);return ['hidden','clip'].includes(c.overflowY)&&n.scrollHeight>n.clientHeight+1;}).map(n=>n.className)}));check(label+' native font, no horizontal overflow or clipped prose',m.font===(big?'32px':'16px')&&m.scroll<=m.width&&!m.overflow.length&&!m.clipped.length,m);}
 async function shot(loc,label){await loc.scrollIntoViewIfNeeded();const path=`${out}/${label}.png`;await loc.screenshot({path});report.screenshots.push({path,sha256:sha(await fs.readFile(path)),kind:'original Chromium element screenshot'});}
 for(const width of [320,390,1280])for(const big of [false,true]){
  const label=`${width}-${big?200:100}`;await page.setViewportSize({width,height:width===320?568:900});
  const s=sim.createRun(0);await load(s,big,label);await click('avg');await page.locator('.choice-card[data-id="build_state"]').click();await page.locator('[data-decision-stage="preview"]').waitFor();
  const ledger=page.locator('[data-local-cost-ledger]'),a=sim.getActions(s,'D4').find(a=>a.id==='build_state'),cell=s.cells.find(c=>c.id==='D4');
  for(const [key,cost]of Object.entries(a.cost).filter(([,v])=>v)){
   const row=page.locator(`[data-local-cost-channel="${key}"]`),track=row.locator('.local-cost-track');
   const m=await track.evaluate(e=>({hidden:e.getAttribute('aria-hidden'),width:e.getBoundingClientRect().width-parseFloat(getComputedStyle(e).borderLeftWidth)-parseFloat(getComputedStyle(e).borderRightWidth),spent:e.children[0].getBoundingClientRect().width,left:e.children[1].getBoundingClientRect().width,pattern:getComputedStyle(e.children[0]).backgroundImage,spentStyle:e.children[0].style.width,leftStyle:e.children[1].style.width}));
   check(label+' '+key+' fixed-scale numeric widths and patterned cost',m.hidden==='true'&&Math.abs(m.spent/m.width*100-Math.min(cell.channels[key],cost))<.05&&Math.abs(m.left/m.width*100-Math.max(0,cell.channels[key]-cost))<.05&&m.pattern.includes('repeating-linear-gradient'),m);
   check(label+' '+key+' original accessible numeric labels remain',json(await row.locator('.local-cost-figures b').allTextContents())===json([cell.channels[key],cost,Math.abs(cell.channels[key]-cost)].map(localCostNumber))&&await row.locator('.local-cost-figures').isVisible());
  }
  check(label+' scale and risk narrative explicit',(await ledger.innerText()).includes('满格为 100')&&(await ledger.innerText()).includes('收益仍须等待合同兑现'));
  await inspect(ledger,big,label+' ledger');await shot(ledger,'ledger-'+label);await exact(s,label+' ledger reading');
  await click('confirm');await page.locator('[data-decision-stage="confirm"]').waitFor();check(label+' confirmation retains ruler',await page.locator('.local-cost-track').count()===Object.values(a.cost).filter(Boolean).length);await exact(s,label+' confirmation only');
  await load(saved.state,big,'round42-year40-'+label);await click('ending');await page.locator('[data-ending-interventions]').waitFor();const ending=page.locator('[data-ending-interventions]');
  await inspect(ending,big,label+' new preserved ending');await exact(saved.state,label+' ending read');
  const recollection=getEndingRecollection(saved.state);for(const c of recollection.lastInterventions){const card=page.locator(`[data-ending-actor="${c.actorId}"]`);check(label+' '+c.actorId+' exact recorded outcome and responsibility',(await card.innerText()).includes(c.outcome)&&(await card.innerText()).includes(c.responsibility));}
  if(width===390&&big)await shot(ending,'new-current-year40-ending-'+label);
  await page.waitForLoadState('networkidle');await page.reload();await page.locator('[data-ending-interventions]').waitFor();await exact(saved.state,label+' ending reload');await inspect(page.locator('[data-ending-interventions]'),big,label+' ending reload');
 }
 check('browser has no page or network errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.inputsAfter=await hashInputs();report.checks.push({name:'all source, tests and scripts unchanged during run',passed:report.inputsBefore===report.inputsAfter});if(report.inputsBefore!==report.inputsAfter)report.failure='Inputs changed during run';report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failure:report.failure||null}));assert.equal(report.failure,undefined);
}
