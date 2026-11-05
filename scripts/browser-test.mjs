import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4174,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[], checks=[];
page.on('pageerror',e=>errors.push(e.message));
const click=async a=>page.locator(`[data-action="${a}"]`).first().click();
const snap=async(name)=>{await page.screenshot({path:`${out}/${name}.png`,fullPage:true});};
const check=(name,passed)=>{assert.ok(passed,name);checks.push({name,passed:true});};
try{
await page.goto('http://127.0.0.1:4174');await page.locator('canvas').waitFor();await snap('01-overview');
check('Initial 64 cells and only protagonist',await page.evaluate(()=>window.afterwave.state.cells.length===64&&window.afterwave.state.actors.length===1));
await click('focus');await snap('02-focus');await click('focus');await click('list');check('List contains all 64 coordinates',await page.locator('.coordinate-row').count()===64);await snap('07-coordinate-list');
for(const id of ['A1','H1','A8','H8','D4']){await page.locator(`[data-action="select"][data-cell="${id}"]`).click();check('List selects '+id,await page.evaluate(id=>window.afterwave.ui.selected===id,id));if(id!=='D4')await click('list');}
const initial=await page.evaluate(()=>JSON.stringify(window.afterwave.state.cells));await click('avg');await snap('03-avg');
for(const id of ['independent_flood_records','unfunded_maintenance']){const b=page.locator(`[data-action="evidence"][data-id="${id}"]`);await b.locator('xpath=ancestor::details').locator('summary').click();await b.click();}
await page.locator('[data-action="choose"][data-id="build_joint"]').click();await click('confirm');await snap('06-lock-review');await click('lock');
check('Lock leaves real world unchanged',initial===await page.evaluate(()=>JSON.stringify(window.afterwave.state.cells)));await snap('08-window-review');
await click('commit');check('Commit pays once',await page.evaluate(()=>window.afterwave.state.cells.find(c=>c.id==='D4').channels.economy===46));await click('skip');check('Year10 after whole decade',await page.evaluate(()=>window.afterwave.state.year===10&&window.afterwave.state.phase==='planning'));await snap('04-decade-review');
await click('home');await click('avg');const successor=page.locator('[data-action="evidence"][data-id="successor_consent"]');await successor.locator('xpath=ancestor::details').locator('summary').click();await successor.click();await page.locator('[data-action="choose"][data-id="recruit_successor"]').click();await click('confirm');await click('lock');await click('commit');await click('skip');
check('Recruit available next window only',await page.evaluate(()=>window.afterwave.state.year===20&&window.afterwave.state.actors.find(a=>a.id==='linche').availableFrom===20));
await click('home');await click('list');await page.locator('[data-action="select"][data-cell="F6"]').click();await click('avg');const anomaly=page.locator('[data-action="evidence"][data-id="anomaly_records"]');await anomaly.locator('xpath=ancestor::details').locator('summary').click();await anomaly.click();await page.locator('[data-action="choose"][data-id="independent_review"]').click();await click('confirm');await click('lock');
check('Cannot submit with unassigned companion',!(await page.locator('[data-action="commit"]').isEnabled()));await page.locator('[data-action="pass"][data-actor="linche"]').click();check('Passed companion is clearly labelled',(await page.locator('body').innerText()).includes('明确放弃'));await click('commit');await click('skip');check('Crisis can be averted',await page.evaluate(()=>window.afterwave.state.flags.crisis.status==='averted'));
await click('home');await click('list');await page.locator('[data-action="select"][data-cell="D4"]').click();await click('avg');await page.locator('[data-action="choose"][data-id="central_review"]').click();await click('confirm');await click('lock');await page.locator('[data-action="pass"][data-actor="linche"]').click();await click('commit');await click('skip');await click('ending');check('Reach actual year40 ending',await page.evaluate(()=>window.afterwave.state.year===40&&window.afterwave.state.phase==='ended'));await snap('09-ending');
await click('archive');await snap('05-archive');const trace=page.locator('[data-action="trace"]').filter({visible:true});await page.locator('[data-action="trace"][data-id*="branch"]').first().click();await snap('10-causal-chain');check('Causal trace includes D4/E4/F6',(await page.locator('.causal-chain').innerText()).includes('F6')&&(await page.locator('.causal-chain').innerText()).includes('E4')&&(await page.locator('.causal-chain').innerText()).includes('D4'));
const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.reload();check('Reload preserves exact state',before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
for(const [width,height] of [[320,568],[360,800],[430,932],[1280,900]]){await page.setViewportSize({width,height});await click('home');await snap(`viewport-${width}`);check(`No horizontal overflow at ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));}
await page.setViewportSize({width:320,height:568});await click('settings');await click('text-size');await click('home');await snap('11-large-text');check('200% text remains within viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
// Regression coverage for externally supplied saves and branch-dependent prose.
const fixtureStates=await page.evaluate(async()=>{
  const sim=await import('/src/simulation.js');
  const fresh=sim.createRun(0), failed=sim.createRun(6);
  sim.lockTask(failed,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);
  sim.commitWindow(failed);sim.advanceToNextWindow(failed);
  return {fresh,failed};
});
async function importFixture(data){
  await click('settings');
  await page.locator('#import-save').setInputFiles({name:'regression-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
}
const hostileUi={selected:'Z99',screen:'__proto__',channel:'unknown',query:null,actor:{},mapTrace:'invalid',bigText:'false',sessions:{'0:protagonist:D4':{evidence:'not-an-array',budget:-99}}};
await importFixture({state:fixtureStates.fresh,ui:hostileUi});
await page.waitForFunction(()=>window.afterwave.state.seed==='0'&&window.afterwave.ui.screen==='world');
check('Malformed imported UI is repaired before rendering and saving',await page.evaluate(()=>{
  const {ui}=window.afterwave, saved=JSON.parse(localStorage.getItem('afterwave.save.v1'));
  return ui.selected==='D4'&&ui.channel==='science'&&ui.actor==='protagonist'&&ui.query===''&&!ui.bigText&&saved.ui.selected==='D4';
}));
check('UI repair preserves exact imported world',JSON.stringify(fixtureStates.fresh)===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
await click('avg');
const repairedEvidence=page.locator('[data-action="evidence"][data-id="independent_flood_records"]');
await repairedEvidence.locator('xpath=ancestor::details').locator('summary').click();await repairedEvidence.click();
check('Repaired investigation session can collect evidence',await page.evaluate(()=>{
  const session=window.afterwave.ui.sessions['0:protagonist:D4'];return session.budget===2&&session.evidence.join()==='independent_flood_records';
}));
await page.reload();
check('Reload preserves normalized investigation evidence and budget',await page.evaluate(()=>window.afterwave.ui.sessions['0:protagonist:D4'].budget===2&&window.afterwave.ui.sessions['0:protagonist:D4'].evidence.length===1));
await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterwave.test.restore');if(fixture){localStorage.setItem('afterwave.save.v1',fixture);sessionStorage.removeItem('afterwave.test.restore');}});
await page.evaluate(fresh=>sessionStorage.setItem('afterwave.test.restore',JSON.stringify({state:fresh,ui:{selected:'missing',screen:'constructor',sessions:null,mapTrace:{},channel:[]}})),fixtureStates.fresh);
await page.reload();await page.locator('canvas').waitFor();
check('Startup repairs invalid selected cell, screen and null sessions',await page.evaluate(()=>window.afterwave.ui.screen==='world'&&window.afterwave.ui.selected==='D4'&&window.afterwave.ui.sessions&&JSON.parse(localStorage.getItem('afterwave.save.v1')).ui.selected==='D4'));
const corrupt=structuredClone(fixtureStates.failed);delete corrupt.institutions[0].annualSource;
const goodWorld=await page.evaluate(()=>JSON.stringify(window.afterwave.state));
await importFixture({state:corrupt});
await page.locator('.toast').filter({hasText:'制度结构或年度产出非法'}).waitFor();
check('Invalid institution import preserves current world and autosave',await page.evaluate(before=>JSON.stringify(window.afterwave.state)===before&&JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)===before,goodWorld));
await importFixture({state:fixtureStates.failed});
await page.waitForFunction(()=>window.afterwave.state.seed==='6'&&window.afterwave.state.year===10&&window.afterwave.ui.screen==='world');
await click('avg');
check('Failed-build year10 scene acknowledges missing station and training',(await page.locator('.prose').innerText()).includes('建站协议没能兑现')&&!(await page.locator('.prose').innerText()).includes('第一批学徒已经'));
await page.locator('[data-action="choose"][data-id="recruit_risk"]').click();await click('confirm');await click('lock');await click('commit');await click('skip');
check('Failed-build recruitment shuts the archive before year20',await page.evaluate(()=>window.afterwave.state.year===20&&window.afterwave.state.institutions.find(i=>i.kind==='archive').active===false&&window.afterwave.state.actors.some(a=>a.id==='linche')));
await click('home');await click('avg');
check('Failed-build year20 scene does not invent a rescued father or station manager',(await page.locator('.prose').innerText()).includes('没有正在运转的水文站')&&!(await page.locator('.prose').innerText()).includes('父亲')&&!(await page.locator('.prose').innerText()).includes('河港的管理者'));
await click('settings');await page.locator('#seed').fill('0');await click('new-confirm');await click('new-run');
check('New-run seed input preserves zero',await page.evaluate(()=>window.afterwave.state.seed==='0'&&window.afterwave.state.year===0));
// No-build path: the UI must create a service, not pretend an existing station owes wages.
for(let window=0;window<2;window++){
  await click('window');await page.locator('[data-action="pass"][data-actor="protagonist"]').click();await click('commit');await click('skip');await click('home');
}
await click('avg');
check('No-build year20 offers a real community warning action',(await page.locator('[data-action="choose"][data-id="free_warning"]').innerText()).includes('建立居民传讯队')&&!(await page.locator('[data-action="choose"][data-id="free_warning"]').innerText()).includes('欠薪'));
const resident=page.locator('[data-action="evidence"][data-id="resident_testimony"]');await resident.locator('xpath=ancestor::details').locator('summary').click();await resident.click();
check('No-build resident evidence does not thank a nonexistent service',(await page.locator('.evidence[open]').innerText()).includes('还没有持续运转的预警载体'));
await page.locator('[data-action="choose"][data-id="free_warning"]').click();
check('Action preview discloses tunable coverage assumptions',(await page.locator('.contract').innerText()).includes('本轮原型假设')&&(await page.locator('.contract').innerText()).includes('0.65'));
await click('confirm');await click('lock');await click('commit');await click('skip');await click('home');
check('Community action creates a visible local service without inventing a station',await page.evaluate(()=>window.afterwave.state.institutions.some(i=>i.kind==='warning'&&i.active)&&!window.afterwave.state.institutions.some(i=>i.kind==='station'))&&(await page.locator('.coverage-report').innerText()).includes('0.65 / 1'));
await page.locator('.toast').waitFor({state:'detached'});await snap('12-community-coverage');
await click('window');await page.locator('[data-action="pass"][data-actor="protagonist"]').click();await click('commit');await click('skip');await click('ending');
check('Ending exposes frozen regional losses and present service separately',(await page.locator('.ending').innerText()).includes('第23年已记录的损失系数')&&(await page.locator('.ending').innerText()).includes('当前预警覆盖系数')&&await page.evaluate(()=>window.afterwave.state.flags.crisis.damageByCell.D4===.7725&&window.afterwave.state.flags.crisis.coverageByCell.D4===.65));
await page.locator('.toast').waitFor({state:'detached'});await snap('13-regional-ending');
const governanceFixtures=await page.evaluate(async()=>{
  const sim=await import('/src/simulation.js'), results={};
  for(const [kind,threshold] of [['merchant',.85],['state',.8],['joint',.7]]){
    let seed=0;while(sim.randomFor(seed,`event:action:0:protagonist:D4:build_${kind}`)>=threshold)seed++;
    const state=sim.createRun(seed);sim.lockTask(state,'protagonist','D4',`build_${kind}`,Object.keys(sim.EVIDENCE));sim.commitWindow(state);sim.advanceToNextWindow(state);
    results[kind]={at10:structuredClone(state)};
    for(let window=0;window<3;window++){sim.passTask(state,'protagonist');sim.commitWindow(state);sim.advanceToNextWindow(state);}
    results[kind].ended=state;
  }
  return results;
});
const endingDetails=[];
for(const kind of ['merchant','state','joint']){
  await importFixture({state:governanceFixtures[kind].at10});await page.waitForFunction(kind=>window.afterwave.state.flags.governance===kind&&window.afterwave.state.year===10&&window.afterwave.ui.screen==='world',kind);
  check(`${kind} governance coverage is visible`,(await page.locator('.coverage-report').innerText()).includes(kind==='merchant'?'0.45 / 1':'1.00 / 1'));
  await importFixture({state:governanceFixtures[kind].ended});await page.waitForFunction(kind=>window.afterwave.state.flags.governance===kind&&window.afterwave.state.year===40&&window.afterwave.ui.screen==='world',kind);await click('ending');
  endingDetails.push(await page.locator('.ending').innerText());
}
check('Governance paths display distinct historical loss results',new Set(endingDetails).size===3&&governanceFixtures.joint.ended.flags.crisis.damage<governanceFixtures.state.ended.flags.crisis.damage&&governanceFixtures.state.ended.flags.crisis.damage<governanceFixtures.merchant.ended.flags.crisis.damage);
// Generate compatibility inputs with the actual frozen original kernel, not edited new states.
const legacyFixtures=await page.evaluate(async()=>{
  const old=await import('/tests/fixtures/legacy-simulation.js');
  const evidence=Object.keys(old.EVIDENCE), submit=(state,action)=>{
    if(action)old.lockTask(state,'protagonist','D4',action,evidence);
    for(const actor of old.getActors(state))if(!state.drafts[actor.id])old.passTask(state,actor.id);
    old.commitWindow(state);
  };
  const noBuild=old.createRun(12);
  for(let window=0;window<2;window++){submit(noBuild);old.advanceToNextWindow(noBuild);}
  submit(noBuild,'free_warning');old.advanceYear(noBuild);
  const at21=structuredClone(noBuild);old.advanceYear(noBuild);old.advanceYear(noBuild);const at23=structuredClone(noBuild);
  old.advanceToNextWindow(noBuild);submit(noBuild);old.advanceToNextWindow(noBuild);
  const risk=old.createRun(12);submit(risk,'build_joint');old.advanceToNextWindow(risk);submit(risk,'recruit_risk');old.advanceToNextWindow(risk);submit(risk,'free_warning');old.advanceYear(risk);
  return {at21,at23,ended:noBuild,risk};
});
await importFixture({state:legacyFixtures.at21});await page.waitForFunction(()=>window.afterwave.state.year===21&&window.afterwave.ui.screen==='world');
check('Genuine old warning promise is disclosed as legacy rather than zero new coverage',(await page.locator('.coverage-report').innerText()).includes('旧版整体危机规则')&&(await page.locator('.coverage-report').innerText()).includes('0.80'));
await click('playback');await click('step');await click('step');
check('Genuine old no-build warning retains original .8 loss and exact year23 channels',await page.evaluate(expected=>window.afterwave.state.flags.crisis.damage===.8&&JSON.stringify(window.afterwave.state.cells)===JSON.stringify(expected.cells)&&window.afterwave.state.flags.crisis.damageByCell===undefined,legacyFixtures.at23));
await importFixture({state:legacyFixtures.risk});await page.waitForFunction(()=>window.afterwave.state.year===21&&window.afterwave.state.flags.recruited===true&&window.afterwave.ui.screen==='world');
check('Genuine old funded station repair restores successor staffing',await page.evaluate(()=>window.afterwave.state.flags.successor===true&&window.afterwave.state.institutions.some(i=>i.kind==='station'&&i.active)));
await importFixture({state:legacyFixtures.ended});await page.waitForFunction(()=>window.afterwave.state.year===40&&window.afterwave.ui.screen==='world');await click('ending');
check('Legacy ending preserves actual loss without inventing regional history',(await page.locator('.ending').innerText()).includes('旧版整体危机规则')&&(await page.locator('.ending').innerText()).includes('没有逐地覆盖与损失明细')&&await page.evaluate(()=>window.afterwave.state.flags.crisis.damage===.8&&window.afterwave.state.flags.crisis.damageByCell===undefined));
check('No browser runtime errors',errors.length===0);await fs.writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}catch(e){await snap('failure');console.error(e);await fs.writeFile(`${out}/results.json`,JSON.stringify({checks,errors,failure:e.message},null,2));process.exitCode=1;}finally{await browser.close();await server.close();}
