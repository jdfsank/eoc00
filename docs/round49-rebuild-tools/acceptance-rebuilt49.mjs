// Independent read-only acceptance audit. Never imports or executes repository tests.
// Usage: node acceptance-rebuilt49.mjs --repo PATH --freeze PATH --stages DIR --output PATH
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((rows,s,i,a)=>s.startsWith('--')?[...rows,[s.slice(2),a[i+1]]]:rows,[]));
for(const k of ['repo','freeze','stages','baseline','catalog','output'])if(!args[k])throw Error('Required --'+k);
const root=path.resolve(args.repo),stageRoot=path.resolve(args.stages),sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFile(p,'utf8'),readJSON=async p=>JSON.parse(await read(p));
const report={scope:'Rebuilt iteration49 fresh aggregate acceptance; not a claim of identity with the lost implementation.',auditedAt:new Date().toISOString(),issues:[],reports:[],stages:{},hashAbsentLimit:'25 legacy browser suites have no intrinsic runtime hash; external frozen-input and freshness checks do not create missing per-suite runtime evidence.'};
const need=(ok,issue)=>{if(!ok)report.issues.push(issue);return ok;};
const get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const statFresh=(mtime,start,end)=>Number.isFinite(mtime)&&mtime>=start&&mtime<=end;
async function files(dir){let out=[];for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(e.isFile())out.push(p);else throw Error('Nonregular input '+p);}return out;}
async function localeFiles(dir){let out=[];for(const e of (await fs.readdir(path.join(root,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.posix.join(dir,e.name);if(e.isDirectory())out.push(...await localeFiles(p));else if(e.isFile())out.push(p);else throw Error('Nonregular input '+p);}return out;}
async function hashRows(names,{basename=false,contentOnly=false}={}){const h=createHash('sha256');for(const f of names){if(!contentOnly)h.update(basename?path.basename(f):f);h.update(await fs.readFile(path.join(root,f)));}return h.digest('hex');}
const memo={};async function expected(scheme){if(scheme in memo)return memo[scheme];let result;
 if(scheme==='absent')return null;
 if(scheme==='recursive-src-locale-path')result=await hashRows(await localeFiles('src'));
 else if(scheme==='src-tests-scripts-locale-json'){const rows=[];for(const dir of ['src','tests','scripts'])for(const f of await localeFiles(dir))rows.push([f,sha(await fs.readFile(path.join(root,f)))]);result=sha(JSON.stringify(rows));}
 else if(scheme==='top-level-src-basename'){const names=(await fs.readdir(path.join(root,'src'),{withFileTypes:true})).filter(x=>x.isFile()).map(x=>'src/'+x.name).sort();result=await hashRows(names,{basename:true});}
 else if(scheme==='runtime-assets-index-lexical-path'){const names=[...await files('src'),...await files('public/assets'),'index.html'].sort();result={sha256:await hashRows(names),files:names.length};}
 else if(scheme==='five-selected-files-content-only')result=await hashRows(['src/main.js','src/style.css','src/decision-stage-copy.js','src/planning-opportunity.js','src/planning-opportunity-view.js'],{contentOnly:true});
 else if(scheme==='recursive-src-per-file-manifest'){result=[];for(const f of await localeFiles('src')){const bytes=await fs.readFile(path.join(root,f));result.push({path:f,bytes:bytes.length,sha256:sha(bytes)});}}
 else throw Error('Unreviewed hash scheme '+scheme);
 memo[scheme]=result;return result;
}
try{
 const freeze=await readJSON(args.freeze),catalogPath=path.resolve(args.catalog),catalog=await readJSON(catalogPath);
 report.freeze={path:path.resolve(args.freeze),sha256:sha(await fs.readFile(args.freeze)),startedAt:freeze.startedAt,files:Object.keys(freeze.hashes||{}).length,oldChanged:freeze.oldChanged,newFiles:freeze.newFiles};
 report.catalog={path:catalogPath,sha256:sha(await fs.readFile(catalogPath))};
 need(Number.isFinite(freeze.startedAt),'Freeze start missing/invalid');need(Object.keys(freeze.hashes||{}).length>642,'Freeze must include original runtime inventory plus additions');
 const actualNames=[...await files('src'),...await files('tests'),...await files('scripts'),...await files('public'),...await files('.github'),'index.html','package.json','package-lock.json','vite.config.js'].sort();
 need(isDeepStrictEqual(actualNames,Object.keys(freeze.hashes||{}).sort()),'Frozen input inventory differs from current complete input inventory');
 const freezeMismatches=[];for(const [file,digest] of Object.entries(freeze.hashes||{})){try{if(sha(await fs.readFile(path.join(root,file)))!==digest)freezeMismatches.push(file);}catch(e){freezeMismatches.push(file+': '+e.message);}}
 report.freeze.mismatches=freezeMismatches;need(!freezeMismatches.length,'Frozen inputs changed or missing');
 const baselinePath=path.resolve(args.baseline),baseline=await readJSON(baselinePath);
 const gitSHA=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
 report.baseline={path:baselinePath,sha256:sha(await fs.readFile(baselinePath)),oldTestsAndScripts:0,mismatches:[]};
 for(const [file,row] of Object.entries(baseline))if(file.startsWith('tests/')||file.startsWith('scripts/')){
  report.baseline.oldTestsAndScripts++;
  try{if(gitSHA(await fs.readFile(path.join(root,file)))!==row.sha)report.baseline.mismatches.push(file);}catch(e){report.baseline.mismatches.push(file+': '+e.message);}
 }
 need(report.baseline.oldTestsAndScripts===274,'Expected all274 previous test/script files in baseline');
 need(!report.baseline.mismatches.length,'Previous tests/scripts changed or missing');
 const expectedNewInputs=['scripts/round49-teaching-timing-test.mjs','src/teaching-timing-context.js','src/teaching-timing-view.js','tests/teaching-timing-context.test.js'];
 need(isDeepStrictEqual(actualNames.filter(file=>!baseline[file]).sort(),expectedNewInputs),'Unexpected new runtime inputs');
 const allowedRuntimeEdits=new Set(['src/main.js','src/style.css','package.json','.github/workflows/verify.yml']);
 report.baseline.otherRuntimeMismatches=[];
 for(const file of actualNames)if(baseline[file]&&!allowedRuntimeEdits.has(file)&&gitSHA(await fs.readFile(path.join(root,file)))!==baseline[file].sha)report.baseline.otherRuntimeMismatches.push(file);
 need(!report.baseline.otherRuntimeMismatches.length,'Unexpected original runtime edits (simulation, saves, story, assets, configuration or readers)');
 const commands={unit:'npm test',build:'npm run build',browser:'npm run test:browser',teaching:'npm run test:teaching-timing',matrix:'npm run test:outlook-matrix',tradeoffs:'node scripts/round21-training-choice-balance.mjs',roles:'node scripts/round22-role-opportunity-audit.mjs'};
 for(const name of ['unit','build','browser','teaching','matrix','tradeoffs','roles']){
  try{const startedAt=Number((await read(path.join(stageRoot,name+'.started'))).trim()),finishedAt=Number((await read(path.join(stageRoot,name+'.finished'))).trim()),exitCode=Number((await read(path.join(stageRoot,name+'.exit'))).trim()),command=(await read(path.join(stageRoot,name+'.command'))).trim(),log=await fs.readFile(path.join(stageRoot,name+'.log'));
   report.stages[name]={startedAt,finishedAt,exitCode,command,logSHA256:sha(log),logBytes:log.length};need(Number.isFinite(startedAt)&&Number.isFinite(finishedAt)&&startedAt>=freeze.startedAt&&finishedAt>=startedAt,name+': invalid stage timing');need(exitCode===0,name+': nonzero exit');need(log.length>0,name+': empty stage log');
   // Exact recorded command retained; browser invocation must run full package aggregate.
   need(command===commands[name],name+': stage command differs from reviewed invocation');
  }catch(e){report.issues.push(name+': missing/incomplete stage evidence: '+e.message);}
 }
 const unitLog=await read(path.join(stageRoot,'unit.log'));
 const unitValue=key=>{const matches=[...unitLog.matchAll(new RegExp('(?:#|ℹ) '+key+' (\\d+)','g'))];return matches.length===1?Number(matches[0][1]):null;};
 report.unit=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,unitValue(key)]));
 need(Number.isInteger(report.unit.tests)&&report.unit.tests>3068&&report.unit.pass===report.unit.tests&&['fail','cancelled','skipped','todo'].every(key=>report.unit[key]===0),'Unit log lacks one complete successful no-skip run with added tests');
 const browser=report.stages.browser;if(!browser)throw Error('Browser stage has not completed; no formal report acceptance possible');
 const names=['unit','build','browser','teaching','matrix','tradeoffs','roles'];for(let i=1;i<names.length;i++){const a=report.stages[names[i-1]],b=report.stages[names[i]];if(a&&b)need(b.startedAt>=a.finishedAt,`${names[i]} started before prior stage completed`);}
 const entries=catalog.entries;need(Array.isArray(entries)&&entries.length===81,'Catalog must contain81 original browser suites');
 const pkg=await readJSON(path.join(root,'package.json')),chain=pkg.scripts['test:browser'].split(/\s*&&\s*/).map(x=>x.trim());need(isDeepStrictEqual(chain,entries.map(x=>'node '+x.script)),'Package aggregate is not the expected ordered81-suite chain');need(new Set(entries.map(x=>x.report)).size===81,'Reports are not81 distinct paths');
 let totalChecks=0,totalPassed=0,hashMatched=0,hashAbsent=0;const groupsTotal={};
 for(const entry of entries){const row={script:entry.script,report:entry.report,scheme:entry.scheme,fields:entry.fields,issues:[]};const ok=(v,s)=>{if(!v){row.issues.push(s);report.issues.push(entry.script+': '+s);}return v;};
  try{
   const scriptBytes=await fs.readFile(path.join(root,entry.script));row.scriptSHA256=sha(scriptBytes);ok(row.scriptSHA256===freeze.hashes[entry.script],'Current script hash differs from freeze');ok(row.scriptSHA256===entry.legacyScriptSHA256,'Original script differs from reviewed iteration48 hash algorithm/source');
   const reportPath=path.join(root,entry.report),bytes=await fs.readFile(reportPath),r=JSON.parse(bytes),st=await fs.stat(reportPath);row.reportSHA256=sha(bytes);row.modified=st.mtimeMs/1000;row.fresh=statFresh(row.modified,browser.startedAt,browser.finishedAt);ok(row.fresh,'Report mtime outside this browser stage');
   row.checkGroups={};row.checks=0;row.passed=0;
   for(const group of entry.groups){const checks=r[group];if(!ok(Array.isArray(checks)&&checks.length>0,'Missing/empty check group '+group))continue;let passed=0;for(const [i,c] of checks.entries()){const success=group==='focusNegativeControls'?c?.rejected===true:c?.passed===true;if(ok(success,`${group}[${i}] did not strictly pass`))passed++;}row.checkGroups[group]=checks.length;row.checks+=checks.length;row.passed+=passed;groupsTotal[group]=(groupsTotal[group]||0)+checks.length;}
   if(entry.baselineChecks!==undefined&&row.checks<entry.baselineChecks){
    // Existing source explicitly treats this external save as optional on ENOENT.
    // Preserve the coverage loss; never invent its two checks or reconstruct the save.
    let optionalMissing=false;try{await fs.stat(path.resolve(root,'../round27-visual-audit/actual-year40-storage.json'));}catch(e){optionalMissing=e.code==='ENOENT';}
    const knownGap=entry.script==='scripts/round27-lifecycle-visuals-test.mjs'&&entry.baselineChecks===491&&row.checks===489&&optionalMissing&&r.actualPlayImport==='Optional baseline save not present; producer coverage only. See separate actual UI flow regression.'&&!r.imports.some(x=>x.name==='actual-ui-baseline-year40');
    if(knownGap){row.coverageGap={omittedChecks:2,reason:r.actualPlayImport,optionalInput:'../round27-visual-audit/actual-year40-storage.json',source:'scripts/round27-lifecycle-visuals-test.mjs:44',historicalChecks:491,actualChecks:489};(report.coverageGaps??=[]).push({script:entry.script,...row.coverageGap});}else ok(false,'Fewer checks than unchanged legacy suite baseline without verified optional-input explanation');
   }
   row.errors=r.errors??[];ok(Array.isArray(row.errors)&&row.errors.length===0,'Report errors present/malformed');row.failure=r.failure??null;ok(!r.failure,'Report failure present');if('exitCode'in r)ok(r.exitCode===0,'Report nonzero/malformed exitCode');
   if('requestFailures'in r)ok(Array.isArray(r.requestFailures)&&r.requestFailures.length===0,'Request failures present');for(const key of ['sourceStable','scriptStable'])if(key in r)ok(r[key]===true,key+' is not true');
   // Do not infer absent intrinsic coverage from stable/fresh report declarations.
   row.expected=await expected(entry.scheme);row.observed=entry.fields.map(field=>({field,value:get(r,field)}));
   if(entry.scheme==='absent'){hashAbsent++;row.matched=null;}
   else{row.matched=row.observed.length===2&&row.observed.every(v=>isDeepStrictEqual(v.value,row.expected));ok(row.matched,'Intrinsic source hashes/manifests do not match independently computed current inputs');if(row.matched)hashMatched++;}
   for(const field of ['scriptBefore','scriptAfter'])if(field in r)ok(r[field]===row.scriptSHA256,field+' does not match current frozen script bytes');
   if(entry.script==='scripts/round42-local-cost-test.mjs'){const tests=await hashRows(await localeFiles('tests'));for(const field of ['testsBefore','testsAfter'])ok(r[field]===tests,field+' differs from independent tests tree hash');}
   row.embeddedTimes={};for(const field of ['startedAt','completedAt','finishedAt'])if(field in r){const time=typeof r[field]==='string'?Date.parse(r[field])/1000:r[field];row.embeddedTimes[field]=r[field];ok(Number.isFinite(time)&&time>=browser.startedAt&&time<=browser.finishedAt,field+' outside browser stage');}
   totalChecks+=row.checks;totalPassed+=row.passed;
  }catch(e){ok(false,e.message);}
  report.reports.push(row);
 }
 report.browser={suites:report.reports.length,checks:totalChecks,passed:totalPassed,checkGroups:groupsTotal,hashMatched,hashAbsent,aggregateStageRecords:1};need(hashMatched===56,'Expected56 independently matched intrinsic source hashes');need(hashAbsent===25,'Expected25 explicitly absent intrinsic source hashes');need(report.reports.length===81,'Expected81 report rows');need(totalChecks>0&&totalChecks===totalPassed,'Aggregate check count not fully passed');
 // Audit supplemental raw rows independently of their summary declarations.
 report.supplemental={};
 async function supplemental(name,file,script){const stage=report.stages[name];if(!stage)throw Error('Missing stage '+name);const full=path.join(root,file),bytes=await fs.readFile(full),r=JSON.parse(bytes),modified=(await fs.stat(full)).mtimeMs/1000;need(statFresh(modified,stage.startedAt,stage.finishedAt),name+': raw report outside stage');const scriptSHA256=sha(await fs.readFile(path.join(root,script)));need(scriptSHA256===freeze.hashes[script],name+': script differs from freeze');report.supplemental[name]={report:file,reportSHA256:sha(bytes),modified,fresh:statFresh(modified,stage.startedAt,stage.finishedAt),script,scriptSHA256};return r;}
 const teaching=await supplemental('teaching','playtest-output/round49-teaching-timing/report.json','scripts/round49-teaching-timing-test.mjs');
 need(Array.isArray(teaching.checks)&&teaching.checks.length>0&&teaching.checks.every(c=>c.passed===true),'Teaching checks absent/failed');
 need(Array.isArray(teaching.errors)&&teaching.errors.length===0&&!teaching.failure,'Teaching errors/failure');
 const teachingExpected=await expected('src-tests-scripts-locale-json');for(const field of ['inputsBefore','inputsAfter'])need(isDeepStrictEqual(teaching[field],teachingExpected),'Teaching intrinsic input hash mismatch '+field);
 for(const field of ['startedAt','completedAt','finishedAt'])if(field in teaching){const t=typeof teaching[field]==='string'?Date.parse(teaching[field])/1000:teaching[field];need(statFresh(t,report.stages.teaching.startedAt,report.stages.teaching.finishedAt),'Teaching embedded timestamp outside stage '+field);}
 Object.assign(report.supplemental.teaching,{checks:teaching.checks?.length,passed:teaching.checks?.filter(c=>c.passed===true).length,intrinsicHash:teachingExpected});
 const matrix=await supplemental('matrix','playtest-output/round6-outlook-matrix.json','scripts/outlook-matrix.mjs');
 need(Array.isArray(matrix.cases)&&matrix.cases.length===888&&matrix.checked===888,'Matrix must contain888 actual cases');need(matrix.failed===0&&matrix.failures.length===0&&matrix.skipped===0&&matrix.skippedCases.length===0,'Matrix failures/skips present');
 const branches=Object.fromEntries(['success','fallback'].map(b=>[b,matrix.cases.filter(c=>c.branch===b).length]));need(isDeepStrictEqual(branches,matrix.branches)&&branches.success===282&&branches.fallback===606,'Matrix branch totals mismatch');need(isDeepStrictEqual(Object.keys(matrix.sourceHashes||{}).sort(),['src/crisis-outlook.js','src/simulation.js']),'Matrix source hash set incomplete');for(const [file,digest] of Object.entries(matrix.sourceHashes))need(digest===sha(await fs.readFile(path.join(root,file))),'Matrix source hash mismatch '+file);Object.assign(report.supplemental.matrix,{checked:matrix.cases.length,failed:matrix.failures.length,skipped:matrix.skippedCases.length,branches,limits:matrix.limits});
 const trade=await supplemental('tradeoffs','playtest-output/round21-training-choice-balance-results.json','scripts/round21-training-choice-balance.mjs');
 const rows=trade.natural,channels=['politics','economy','science','religion'];need(Array.isArray(rows)&&rows.length===644,'Tradeoffs must contain644 natural pairs');const totals={pairs:rows.length,crossingPairs:0,sameTitles:0,sameCoverage:0,sameCrisis:0,sameReadiness:0,allValid:true,unchangedOriginalSources:true,balanced:trade.balanced};
 for(const [i,row] of rows.entries()){const a=row.authorization,t=row.training,d=Object.fromEntries(channels.map(k=>[k,+(t.channels[k]-a.channels[k]).toFixed(4)]));need(isDeepStrictEqual(d,row.delta),'Tradeoff delta mismatch '+i);if(Object.values(d).some(x=>x>0)&&Object.values(d).some(x=>x<0))totals.crossingPairs++;totals.sameTitles+=a.title===t.title;totals.sameCoverage+=isDeepStrictEqual(a.coverage,t.coverage);totals.sameCrisis+=isDeepStrictEqual(a.crisis,t.crisis);totals.sameReadiness+=isDeepStrictEqual(a.readiness,t.readiness);totals.allValid&&=a.valid===true&&t.valid===true;totals.unchangedOriginalSources&&=isDeepStrictEqual(a.trainingSource,t.trainingSource);}
 for(const [k,v] of Object.entries(totals))need(trade.summary[k]===v,'Tradeoff summary disagrees with raw rows: '+k);need(totals.crossingPairs===644&&totals.allValid&&totals.unchangedOriginalSources&&trade.balanced===false,'Tradeoff outcome inconsistent');need(trade.legacy.length===12&&trade.legacy.every(x=>x.identicalOnRestore===true&&x.identicalAfter===true&&x.allYearsIdentical===true&&Array.isArray(x.years)&&Object.hasOwn({planning:31,locked:31,committed:31,year31:32,year35:36,ended:41},x.phase)&&isDeepStrictEqual(x.years.map(y=>y.year),Array.from({length:41-({planning:31,locked:31,committed:31,year31:32,year35:36,ended:41}[x.phase])},(_,i)=>i+({planning:31,locked:31,committed:31,year31:32,year35:36,ended:41}[x.phase])))&&x.years.every(y=>y.identical===true)),'Tradeoff legacy restoration mismatch');Object.assign(report.supplemental.tradeoffs,totals,{reviewFailures:rows.filter(x=>x.review==='failed').length,scope:trade.scope,meaning:'644 sampled crossing tradeoffs; balanced=false, not universal game balance or human validation.'});
 const roles=await supplemental('roles','playtest-output/round22-role-opportunity-audit.json','scripts/round22-role-opportunity-audit.mjs');need(roles.pairs.length===10&&roles.futureChecks.length===2,'Role evidence cardinality mismatch');
 let sameCapability=0,noPolicy=0,noWarning=0;for(const pair of roles.pairs){const a=pair.mainDoesWork.final,b=pair.companionDoesWork.final;const omit=({title,policy,...rest})=>rest;if(isDeepStrictEqual(omit(a),omit(b)))sameCapability++;if(a.canShare===true&&a.policy===null)noPolicy++;if(pair.support==='train_network'&&pair.mainDoesWork.at30.warnings.length===0)noWarning++;need(a.valid===true&&b.valid===true&&a.workStatus==='success'&&b.workStatus==='success'&&b.policy==='share_power','Role pair violates recorded outcome');}
 const valid=roles.futureChecks.every(x=>x.valid===true&&x.policy===null&&x.outcome===(x.preparation?'success':'cancelled'));need(valid&&sameCapability===10&&noPolicy===10&&noWarning===5&&roles.summary.balanced===false,'Role evidence differs from expected sampled outcomes');need(roles.summary.pairs===roles.pairs.length&&roles.summary.rolePairsWithSameCompletedWorkAndCapability===sameCapability&&roles.summary.noPolicyDespiteReadyToShare===noPolicy&&roles.summary.ordinaryTrainingWithoutEngineWarning===noWarning,'Role summary disagrees with raw rows');Object.assign(report.supplemental.roles,{pairs:roles.pairs.length,futureChecks:roles.futureChecks.length,sameCapability,noPolicyDespiteReadyToShare:noPolicy,ordinaryTrainingWithoutEngineWarning:noWarning,balanced:false,scope:roles.summary.scope,interpretation:roles.summary.interpretation});
 // Re-read every frozen input after audit too; auditing may not straddle a source change.
 const afterNames=[...await files('src'),...await files('tests'),...await files('scripts'),...await files('public'),...await files('.github'),'index.html','package.json','package-lock.json','vite.config.js'].sort();need(isDeepStrictEqual(actualNames,afterNames),'Input inventory changed during audit');const after=[];for(const [file,digest] of Object.entries(freeze.hashes))if(sha(await fs.readFile(path.join(root,file)))!==digest)after.push(file);report.freeze.afterMismatches=after;need(!after.length,'Inputs changed during acceptance audit');
}catch(e){report.issues.push('Audit could not complete: '+e.message);}
report.auditScriptSHA256=sha(await fs.readFile(fileURLToPath(import.meta.url)));report.evidenceValid=report.issues.length===0;report.baselineCoverageEquivalent=report.reports.length===81?!(report.coverageGaps?.length):null;report.passed=report.evidenceValid&&report.baselineCoverageEquivalent;report.acceptanceStatus=report.passed?'complete':report.evidenceValid?'valid-executed-checks-but-baseline-coverage-gap':'failed-evidence';
await fs.writeFile(path.resolve(args.output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,evidenceValid:report.evidenceValid,baselineCoverageEquivalent:report.baselineCoverageEquivalent,acceptanceStatus:report.acceptanceStatus,browser:report.browser,issues:report.issues,output:path.resolve(args.output)}));if(!report.passed)process.exitCode=1;
