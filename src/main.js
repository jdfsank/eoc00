import {renewalDisplay,feeRecordDisplay} from './verified-contract-display.js';
import {createSaveCoordinator} from '../milestone1/save-coordinator.js';
import {navigateTeaching} from './teaching-navigation.js';
import {createStartupSaveGuard} from './startup-save-guard.js';
import {getTeachingTimingContext} from './teaching-timing-context.js';
import {renderTeachingTiming} from './teaching-timing-view.js';
import {getWindowReadinessContext} from './window-readiness-context.js';
import {renderWindowReadiness,navigateWindowReadiness} from './window-readiness-view.js';
import {getRoleReadingChoice} from './role-reading-choice.js';
import {renderRoleReadingChoice} from './role-reading-choice-view.js';
import {getLocalCostLedger} from './local-cost-ledger.js';
import {renderLocalCostLedger} from './local-cost-ledger-view.js';
import {getSceneContractAnchor} from './scene-contract-anchor.js';
import {getPolicyChoiceFork} from './policy-choice-fork.js';
import {renderPolicyForkDetail,renderPolicyForkTiming} from './policy-choice-fork-view.js';
import {getCrisisChoiceFork} from './crisis-choice-fork.js';
import {renderCrisisForkDetail} from './crisis-choice-fork-view.js';
import {getSuccessionChoiceFork} from './succession-choice-fork.js';
import {renderSuccessionForkDetail} from './succession-choice-fork-view.js';
import {getBuildingCardTradeoff} from './building-card-tradeoff.js';
import {renderChoiceAgency,navigateActorAgency} from './actor-agency-view.js';
import {renderDecadeRecollection,renderDecadeSettlement} from './decade-recollection-view.js';
import {navigateDraftComparison} from './draft-comparison-navigation.js';
import {getDraftEditContext} from './draft-edit-context.js';
import {renderDraftEditContext} from './draft-edit-context-view.js';
import {getDraftChoiceComparison} from './draft-choice-comparison.js';
import {renderDraftChoiceComparison} from './draft-choice-comparison-view.js';
import {getSceneSourceReading} from './scene-source-reading.js';
import {getStageBoundaryContext} from './stage-boundary-context.js';
import {getOpeningReadingContext} from './opening-reading-context.js';
import {createEvidenceBookmark,readEvidenceBookmark} from './evidence-bookmark.js';
import {getReviewReadingContext} from './review-reading-context.js';
import {getRecordStageContext} from './record-stage-context.js';
import {getWorldPhaseContext} from './world-phase-context.js';
import {getEndingPolicyContext} from './ending-policy-context.js';
import './style.css';
import {createImportRequestGuard} from './import-request-guard.js';
import {getSuccessionSceneContext} from './succession-scene-context.js';
import {getComparisonGuidance,renderComparisonGuidance} from './comparison-guidance.js';
import {getWorldPlanning} from './world-planning.js';
import {getCrisisSceneContext} from './crisis-scene-context.js';
import {getCrossLocationInvestigation} from './investigation-cross-location.js';
import {renderCrossLocationInvestigation} from './investigation-cross-location-view.js';
import {getActionCardTradeoff} from './action-card-copy.js';
import {getPlaybackJournal,getPlaybackRecordIds,hasNewPlaybackRecord} from './playback-journal.js';
import {getDecisionStageCopy,getActionResponsibility,getLockedOutcomeLabel} from './decision-stage-copy.js';
import {getPlanningOpportunity} from './planning-opportunity.js';
import {renderPlanningOpportunity} from './planning-opportunity-view.js';
import {createRun,getActors,getActions,lockTask,passTask,unlockTask,commitWindow,advanceYear,advanceToNextWindow,getEnding,traceEvent,getWarningCoverage,usesLegacyCrisisRules,getWindowReview,usesTradeoffs,usesHandoffRules,usesAftermathRules,usesRecruitmentRules,usesRecoveryRules,usesFutureCheckRules,usesArchiveUpgradeRules,usesPortAccessRules,usesTrainingWorkloadRules,getActorRefusals,getStaffingRulesVersion,getStaffingRulesDescription,getInvestigation,getEvidenceIds,evidenceCost,investigate} from './simulation.js';
import {makeBoard} from './board.js';
import {getCrisisRegions} from './crisis-regions.js';
import {sceneArt} from './scene-art.js';
import {getEndingArt} from './ending-art.js';
import {getTrainingChoiceComparison} from './training-choice-comparison.js';
import {renderTrainingChoiceComparison} from './training-choice-comparison-view.js';
import {getEndingRecollection} from './ending-recollection.js';
import {getSceneVisit} from './scene-visit.js';
import {getCrisisOutlook} from './crisis-outlook.js';
import {getInvestigationComparison} from './investigation-comparison.js';
import {renderInvestigationComparison} from './investigation-comparison-view.js';
import {getHandoffOutlook} from './handoff-outlook.js';
import {getActionPreview} from './action-preview.js';
import {getInvestigationPlan} from './investigation-plan.js';
import {evidenceTitleFor,investigationIntentFor} from './investigation-intent.js';
import {renderInvestigationBudget,renderActionResearch,renderMaterialSummary,renderMaterialDecision,renderContractResearch} from './investigation-plan-view.js';
import {getBuildingContract} from './building-contract.js';
import {BRANCH_ACCESS_RULES,getBranchAccessRulesVersion,getBranchAccessRulesDescription,getFutureBranchAccess} from './branch-access.js';
import {getReviewHistory} from './review-history.js';
import {getLocalCrisisRecord} from './local-crisis-record.js';
import {getChannelHistory} from './channel-history.js';
import {getFeeHistory} from './fee-history.js';
import {getRelocationContract,getRelocationHistory,getRelocationDestination} from './relocation-history.js';
import {getCrisisHistory} from './crisis-history.js';
import {getStageDecadeReview as getDecadeReview} from './stage-decade-review.js';
import {HEAT_BANDS,HEAT_PALETTES,institutionVisual,mapActivity} from './board-visuals.js';
import {sceneFor,evidenceText,evidenceFor,characterEpilogue} from './story.js';
import {createUi,restoreSave} from './save.js';
const ROOT=document.querySelector('#app'),KEY='afterwave.save.v1';
const names={politics:'政治',economy:'经济',science:'科学',religion:'宗教'},symbols={politics:'▣',economy:'▤',science:'⌘',religion:'◉'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,ui=createUi();let board,mapView=null,timer=null,toastTimer=null,toast='',saveIssue='';
let evidenceBookmark=null,evidenceReturnPointer=false,playbackPointerAdvance=false;
let opportunityReturn=null;
let pendingNewRun=null,sceneSourceReturn=null,sceneSourcePointerTarget=null,draftEdit=null;
function cancelNewRun(){pendingNewRun=null;ROOT.querySelector('#reset-confirm')?.replaceChildren();}
let endingReturn=null,readingReturn=null,sceneReturn=null,playbackNotice='',scenePointerJump=false;
const importRequests=createImportRequestGuard();let importReading=false;
const importReadingText='正在读取存档。选择其他文件或离开设置会取消本次读取。';
function setImportReading(reading){importReading=reading;const status=ROOT.querySelector('[data-import-status]');if(status){status.hidden=!reading;status.textContent=reading?importReadingText:'';}}
function cancelImport(){importRequests.invalidate();setImportReading(false);}
let storageBusy=false,suppressAutoSave=false,saveSequence=0,settledSaveSequence=0;
const startupGuard=createStartupSaveGuard({getItem:key=>localStorage.getItem(key)},KEY,restoreSave,coordinatedCommit);
const saveWriter=createSaveCoordinator({initialRaw:startupGuard.raw,read:()=>localStorage.getItem(KEY),write:raw=>localStorage.setItem(KEY,raw),acquire:navigator.locks?.request?navigator.locks.request.bind(navigator.locks):undefined});
const storageBar=document.createElement('aside');storageBar.className='storage-bar';storageBar.setAttribute('aria-label','本地存档状态');storageBar.innerHTML='<span data-save-status role="status" aria-live="polite" aria-atomic="true">本地保存</span><button type="button" data-action="save-details">详情</button><button type="button" data-action="cancel-save" aria-label="取消等待保存" disabled>取消</button>';
document.body.append(storageBar);
const storageDialog=document.createElement('dialog');storageDialog.className='storage-dialog';storageDialog.setAttribute('aria-labelledby','storage-dialog-title');storageDialog.innerHTML='<h2 id="storage-dialog-title" tabindex="-1" autofocus>本地存档状态</h2><p class="storage-dialog-body" tabindex="0" aria-label="保存状态说明"></p><form method="dialog"><button>关闭</button></form><span class="storage-dialog-announcement" role="status" aria-live="polite" aria-atomic="true"></span>';document.body.append(storageDialog);
function storageReadOnly(){const v=saveWriter.snapshot();return v.closed||v.conflicted||v.blocked||!v.supported;}
function storageReason(reason){return ({timeout:'等待保存超时，未提交此项写入。请导出当前进度，解除其他页面占用后再操作重试。',cancelled:'已取消等待中的保存；已完成的写入不会撤销。请导出当前进度，避免关闭后丢失。',conflict:'其他页面已更改存档。本页已停止写入，内存进度仍保留。请导出本页进度，再刷新核对。',closed:'此页面已经离开，返回后只读。请导出本页进度，再刷新核对。',unsupported:'浏览器不支持安全跨页保存，本页只读。请导出进度，并使用支持 Web Locks 的安全浏览器。',uncertain:'无法核实磁盘中的存档，本页已停止写入。请保留原始数据并导出本页进度，再刷新核对。'})[reason]||'浏览器未能保存。请导出当前进度，恢复存储空间或权限后再操作重试。';}
function storagePresentation(){
 const v=saveWriter.snapshot();
 if(v.pending)return {label:'等待保存',description:'正在等待保存，可取消等待；取消不会撤销已经完成的写入。'};
 if(saveIssue||storageReadOnly())return {label:'未保存',description:saveIssue||storageReason(v.lastError||(!v.supported?'unsupported':'closed'))};
 if(startupGuard.blocked)return {label:'保存暂停',description:startupGuard.kind==='unreadable'?'无法读取浏览器存储，不能确认原始数据；自动保存已暂停。请恢复存储权限后刷新。':'原存档无法读取，自动保存已暂停，原始数据尚未被此页面覆盖。请先下载原始数据，再明确选择恢复方式。'};
 return {label:'本地保存',description:'本页使用合作式跨页锁保存。旧版无锁页面仍可能覆盖存档，请关闭旧页面。'};
}
let storageDialogAnnouncement='';
storageDialog.addEventListener('close',()=>{storageDialogAnnouncement='';storageDialog.querySelector('.storage-dialog-announcement').textContent='';});
function refreshStorageDialog(presentation){if(!storageDialog.open)return;const announcement=presentation.label+'。'+presentation.description;if(announcement!==storageDialogAnnouncement){storageDialogAnnouncement=announcement;storageDialog.querySelector('.storage-dialog-announcement').textContent=announcement;}const body=storageDialog.querySelector('p'),title=storageDialog.querySelector('h2');if(body.textContent!==presentation.description){const scroll=body.scrollTop;body.textContent=presentation.description;body.scrollTop=scroll;}if(title.textContent!==presentation.label){title.textContent=presentation.label;title.setAttribute('aria-label','本地存档状态：'+presentation.label+'。状态更新，详细说明可滚动阅读。');}}
function refreshStorageStatus(){const v=saveWriter.snapshot(),presentation=storagePresentation(),status=storageBar.querySelector('[data-save-status]');if(status.textContent!==presentation.label)status.textContent=presentation.label;storageBar.querySelector('[data-action="cancel-save"]').disabled=!v.pending;status.setAttribute('aria-label',presentation.description);refreshStorageDialog(presentation);}
storageBar.addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='cancel-save'){saveWriter.cancelPending();updateSaveIssue(storageReason('cancelled'));}if(action==='save-details'){storageDialog.querySelector('p').textContent=storagePresentation().description;storageDialog.showModal();refreshStorageDialog(storagePresentation());storageDialog.querySelector('h2').focus({preventScroll:true});storageDialog.querySelector('p').scrollTo({top:0,behavior:'instant'});storageDialog.scrollTop=0;}});
async function coordinatedCommit(raw){const number=++saveSequence;const pending=saveWriter.save(raw);refreshStorageStatus();const result=await pending;if(number>=settledSaveSequence){settledSaveSequence=number;updateSaveIssue(result.ok?'':storageReason(result.reason));}if(storageReadOnly())stop();refreshStorageStatus();if(!result.ok)throw Error(storageReason(result.reason));return true;}

if(startupGuard.loaded)({state,ui}=startupGuard.loaded);state??=createRun(12);
let recoveryConfirm=false,recoveryError='';
if(startupGuard.blocked)ui.screen='settings';
async function persist(value){return startupGuard.save(value);}
function updateSaveIssue(text){saveIssue=text;refreshStorageStatus();}
async function save(){if(startupGuard.blocked||storageBusy||suppressAutoSave)return false;try{return await persist({state,ui});}catch{return false;}}
function recoveryPage(){return `<main class="page narrow recovery-page" data-save-recovery><span class="eyebrow">PRESERVATION</span><h1>先保留原来的历史。</h1><p role="alert">${startupGuard.kind==='invalid'?'存档无法读取。原始数据尚未被此页面覆盖，自动保存已暂停。':'浏览器存储无法读取。无法确认原始数据，自动保存已暂停；请恢复存储权限后刷新。'}</p><p>这里还没有开始新历史。原始数据下载只保存原文，不保证能够修复。</p>${recoveryError?`<p role="alert">${esc(recoveryError)}</p>`:''}<div class="settings-actions">${button(ui.bigText?'恢复标准字号':'启用 200% 字号','recovery-text')}${startupGuard.raw!==null?button('下载原始存档数据','recovery-export'):''}${startupGuard.kind==='invalid'?`<label class="file-button">导入有效存档并替换原数据<input id="import-save" type="file" accept="application/json,.json"></label>${button('放弃原数据并开始新历史（先确认）','recovery-confirm','','secondary')}`:''}</div><p data-import-status role="status" aria-live="polite"${importReading?'':' hidden'}>${importReading?esc(importReadingText):''}</p>${recoveryConfirm?`<section class="notice" data-recovery-confirm><h2>确认替换原始数据？</h2><p>将以种子12开始新历史并替换此浏览器的原存档。请先下载原始数据；取消不会覆盖它。</p>${button('确认替换并开始','recovery-replace')}${button('取消，保留原数据','recovery-cancel','','secondary')}</section>`:''}</main>`;}
function focusRecoveryDestination(completed=false){
 const visible=el=>el?.isConnected&&!el.disabled&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const trigger=completed?null:ROOT.querySelector('[data-action="recovery-confirm"]');
 const target=[trigger,ROOT.querySelector('[data-save-recovery] h1'),ROOT.querySelector('[data-primary-action]'),ROOT.querySelector('main h1,main'),storageBar.querySelector('[data-action="save-details"]')].find(visible);
 if(!target)return;
 if(!target.matches('button,a,input,select,textarea,[tabindex]'))target.setAttribute('tabindex','-1');
 target.focus();
}
async function recoveryClick(a){
 if(a==='recovery-text'){ui.bigText=!ui.bigText;render();}
 else if(a==='recovery-export'&&startupGuard.raw!==null){const url=URL.createObjectURL(new Blob([startupGuard.raw],{type:'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download='afterwave-unreadable-original.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 else if(a==='recovery-confirm'){cancelImport();recoveryConfirm=true;render();ROOT.querySelector('[data-action="recovery-replace"]')?.focus();}
 else if(a==='recovery-cancel'){recoveryConfirm=false;render();focusRecoveryDestination();}
 else if(a==='recovery-replace'&&recoveryConfirm){try{const replacement={state:createRun(12),ui:createUi()};storageBusy=true;await startupGuard.replace(replacement);recoveryConfirm=false;({state,ui}=replacement);render();focusRecoveryDestination(true);}catch(e){recoveryError=e.message;recoveryConfirm=false;render();focusRecoveryDestination();}finally{storageBusy=false;refreshStorageStatus();}}
}

function button(label,action,extra='',className=''){return `<button class="${className}" data-action="${action}" ${extra}>${label}</button>`;}
function tag(text,kind=''){return `<span class="tag ${kind}">${esc(text)}</span>`;}
function getCell(){return state.cells.find(c=>c.id===ui.selected);}
function actors(){return getActors(state);}
function selectedActor(){return actors().find(a=>a.id===ui.actor)||actors()[0]||{id:'protagonist',name:'介入员'};}
function actions(){return getActions(state,ui.selected,selectedActor().id).map(a=>renewalDisplay(state,a,ui.selected));}
function session(){const key=`${state.year}:${selectedActor().id}:${ui.selected}`;if(usesTradeoffs(state))ui.sessions[key]=getInvestigation(state,selectedActor().id,ui.selected);return ui.sessions[key]??={evidence:[],budget:3};}
function bookmarkContext(){return {screen:ui.screen,actorId:selectedActor().id,cellId:ui.selected,actionId:ui.choice};}
function evidenceBookmarkMarkup(materialId){
 const view=readEvidenceBookmark(evidenceBookmark,state,bookmarkContext(),session().evidence);
 if(!view){evidenceBookmark=null;return '';}
 if(view.materialId!==materialId)return '';
 const status=view.missing.length?`尚需：${view.missing.map(id=>evidenceTitleFor(state,id,ui.selected,selectedActor().id)).join('、')}。`:'所需材料已齐，尚未因此锁定任务。';
 return `<aside class="evidence-bookmark" data-evidence-bookmark="${esc(view.actionId)}" data-bookmark-ready="${view.missing.length===0}"><span class="evidence-bookmark-label">为这项方案取证</span><strong>${esc(view.title)}</strong><p>${esc(status)}</p>${button(`回到「${esc(view.title)}」核对`,'evidence-return','','secondary')}<small>只返回免费预览，不锁定、不扣费；仍可改选。</small></aside>`;
}
// Cross-role reading stores only a return address, never a draft or inventory copy.
function opportunityReturnPanel(){
 const origin=opportunityReturn;
 if(!origin)return '';
 if(origin.state!==state||origin.year!==state.year||state.phase!=='planning'||!['avg','choice','confirm'].includes(ui.screen)||ui.actor!==origin.destination.actorId||ui.selected!==origin.destination.cellId){opportunityReturn=null;return '';}
 return `<aside class="opportunity-reading-return" data-opportunity-reading-return><p>正在查看${esc(selectedActor().name)} · ${esc(ui.selected)}${ui.choice?` · ${esc(actionById(ui.choice)?.title||'合同')}`:'方针目录'}。查看没有改动两人的安排，尚未替换或提交。</p>${button('返回刚才的主角方案','opportunity-return','','secondary')}${button('核对两人的本轮安排','window','','text-button')}</aside>`;
}
function navigatePlanningOpportunity(routeId){
 if(!['choice','confirm'].includes(ui.screen))return;
 const view=getRoleReadingChoice(state,{actorId:selectedActor().id,cellId:ui.selected,actionId:ui.choice});
 const destination=view?.links.find(link=>link.id===routeId);
 if(!destination)return;
 const origin=Object.freeze({state,year:state.year,screen:ui.screen,actor:ui.actor,cellId:ui.selected,actionId:ui.choice,draftEdit,sceneReturn,destination:Object.freeze({...destination})});
 evidenceBookmark=null;sceneReturn=null;
 ui.actor=destination.actorId;ui.selected=destination.cellId;ui.choice=destination.actionId;
 draftEdit=getDraftEditContext(state,ui.actor)?{state,year:state.year,actorId:ui.actor}:null;
 opportunityReturn=origin;mapView=null;
 go(destination.actionId?'choice':'avg');
 if(!destination.actionId)focusSceneSection('choices');
 else ROOT.querySelector('main h1')?.scrollIntoView({block:'nearest',behavior:'instant'});
}
function restorePlanningOpportunity(){
 const origin=opportunityReturn;
 if(!origin||origin.state!==state||origin.year!==state.year||state.phase!=='planning'
   ||!['avg','choice','confirm'].includes(ui.screen)||ui.actor!==origin.destination.actorId||ui.selected!==origin.destination.cellId)return;
 if(!getActions(state,origin.cellId,origin.actor).some(action=>action.id===origin.actionId))return;
 opportunityReturn=null;ui.actor=origin.actor;ui.selected=origin.cellId;ui.choice=origin.actionId;
 draftEdit=origin.draftEdit;sceneReturn=origin.sceneReturn;mapView=null;
 go(origin.screen);
}
function actionById(id){return actions().find(a=>a.id===id);}
function costText(cost){const pairs=Object.entries(cost||{}).filter(([,v])=>v);return pairs.length?pairs.map(([k,v])=>`${names[k]||k} −${Math.abs(v)}`).join(' · '):'无通道即时成本';}
function chanceText(a){if(a.conditional)return `第 ${state.year+(a.dueIn||0)} 年核对条件，${a.id==='authorize_training'?'原培训点失效、被替换或已获授权':a.id==='open_port_warning'?'原分站失效或已开放':a.id==='establish_future_check'?'缺实际测量/教学人手':a.id==='upgrade_archive_check'?'原保档或实际测量/教学人手失效':'缺人手或原记录'}则取消`;return a.probability!=null&&a.probability<1?`${Math.round(a.probability*100)}% · 第 ${state.year+(a.dueIn||0)} 年一次性判定`:`第 ${state.year+(a.dueIn||0)} 年生效`;}
function channels(c){return `<div class="channels">${Object.entries(names).map(([k,n])=>`<div class="channel ${k}"><span>${symbols[k]} ${n}</span><strong>${Number(c.channels[k]).toFixed(1)}</strong><div class="meter"><i style="width:${c.channels[k]}%"></i></div></div>`).join('')}</div>`;}
function coveragePanel(cellId){if(usesLegacyCrisisRules(state))return `<div class="notice coverage-report"><strong>旧版整体危机规则</strong><p>${state.flags.freeWarning?'免费预警承诺已兑现，四地剩余损失仍按旧规则乘以0.80。':'本局沿用旧版已作出承诺的危机规则。'}</p><p class="tiny">旧存档没有逐地覆盖记录，不用新系数重算过去或取消已有行动效果。</p></div>`;const service=getWarningCoverage(state)[cellId];return `<div class="notice coverage-report" data-coverage-cell="${esc(cellId)}"><strong>预警覆盖系数 ${service.coverage.toFixed(2)} / 1</strong><p>${service.coverage?'现存载体：'+service.providers.map(i=>esc(state.institutions.find(item=>item.id===i.institutionId)?.name)).join('、'):'这里没有运转中的预警载体。档案与四通道数值不会自动变成公开服务。'}</p><p class="tiny">本轮原型假设：覆盖由开放、维护和人手决定，不是人口统计。${service.protection?'治理来源另提供 '+Math.round(service.protection*100)+'% 的有限保护；仍需处理共同失效。':''}</p></div>`;}
function localCrisisPanel(record,compact=false){if(!record||record.status==='pending')return '';return `<section class="notice local-crisis-history" data-crisis-cell="${esc(record.cellId)}" data-crisis-status="${esc(record.status)}"><div class="crisis-tally-heading">${record.markerFile?`<img src="${import.meta.env.BASE_URL}assets/${esc(record.markerFile)}" alt="${esc(record.markerAlt)}" width="64" height="72">`:''}<h2>${esc(record.title)}</h2></div><p>${esc(record.summary)}</p>${!compact&&record.detail?.length?`<ul>${record.detail.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}${record.recordId?button('查看第23年清点的原始记录','trace',`data-id="${esc(record.recordId)}"`,'text-button'):'<p class="tiny">没有可核实的原始清点记录，不补写来源。</p>'}</section>`;}
function channelComparison(c){return `<article class="channel-comparison" data-from-year="${c.fromYear}" data-to-year="${c.toYear}" data-comparison-status="${esc(c.status)}"><h3>第 ${c.fromYear} → ${c.toYear} 年</h3><div class="historical-channels">${c.channels.map(v=>`<div data-history-channel="${esc(v.key)}"><h4>${esc(v.label)}</h4><p>${esc(v.fromText)} → ${esc(v.toText)}</p><strong>${v.status==='recorded'?`净变化 ${esc(v.deltaText)}`:'净变化未知'}</strong></div>`).join('')}</div></article>`;}
function channelHistoryPanel(cellId){const h=getChannelHistory(state,cellId);if(!h)return '';const latest=h.latestComparison;return `<section class="notice channel-history" data-channel-cell="${esc(cellId)}"><h2>${esc(h.title)}</h2><p>${esc(h.summary)}</p><p class="history-checkpoints">${h.checkpoints.map(c=>`第${c.year}年 · ${c.status==='recorded'?'有结算页':c.status==='partial'?'部分已知':'未知/缺页'}`).join(' ｜ ')}</p>${latest?channelComparison(latest):`<p>还没有两个已结束窗口的结算页可比较。</p><div class="historical-channels">${h.checkpoints[0].channels.map(v=>`<div data-history-channel="${esc(v.key)}"><h4>${esc(v.label)} · 第0年</h4><p>${esc(v.valueText)}</p></div>`).join('')}</div>`}${h.comparisons.length>1?`<details class="earlier-channel-history"><summary>查看更早的已存十年对照</summary>${h.comparisons.slice(0,-1).reverse().map(channelComparison).join('')}</details>`:''}<ul class="tiny">${h.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section>`;}
function feeHistoryPanel(recordId){const f=getFeeHistory(state,recordId);if(!f)return '';return `<section class="notice fee-history" data-fee-record="${esc(recordId)}" data-fee-status="${esc(f.status)}"><h3>${esc(f.title)}</h3><p>${esc(f.explanation)}</p>${f.detail.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="button-row">${f.sources.map((e,index)=>button(`查看治理来源 ${index+1}`,'trace',`data-id="${esc(e.id)}"`,'text-button')).join('')}</div></section>`;}
function staffingPolicyPanel(){return `<details class="notice staffing-policy"><summary>后续人手结算规则 · ${getStaffingRulesVersion(state)==='station-only-v1'?'仅测站':'D4测站与档案站'}</summary><p>${esc(getStaffingRulesDescription(state))}</p></details>`;}
function branchPolicyPanel(){return `<details class="notice branch-policy" data-branch-rule="${esc(getBranchAccessRulesVersion(state))}"><summary>后续分站准入 · ${getBranchAccessRulesVersion(state)===BRANCH_ACCESS_RULES.public?'原建站链公开':'按原资助来源'}（仅未来）</summary><p>${esc(getBranchAccessRulesDescription(state))}</p></details>`;}
function pendingBranchPanel(e){if(e.actionId!=='branch'||e.status!=='pending')return '';const h=getFutureBranchAccess(state,e.sourceActionId);return `<section class="notice pending-branch-policy"><h3>尚未兑现的分站准入</h3><p>${esc(h.description)}</p>${branchPolicyPanel()}</section>`;}
function actionClaim(a,field,options={}){const h=getBuildingContract(state,a?.id,options);return h?.[field==='risk'?'displayRisk':'displayReward']||a?.[field]||(field==='risk'?'将占用当前棋子的十年机会，其他地点需要等待。':a?.description);}
function buildingContractPanel(a,options){const h=getBuildingContract(state,a?.id,options);if(!h)return '';return `<section class="notice building-contract" data-building-action="${esc(h.actionId)}"><h2>三种建站都要承担的后续责任</h2><ul>${h.commonTerms.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><h3>这份方案的不同之处</h3><ul>${h.differenceTerms.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><details><summary>年度源项与旧规则说明</summary><p>${esc(h.annualSourceNote)}</p><p>${esc(h.compatibilityNote)}</p></details><p class="tiny">${esc(h.prototypeNote)}</p></section>`;}
function actionContext(a,options={}){return `${buildingContractPanel(a,options)}${a?.staffingNote?`<p class="notice staffing-contract">${esc(a.staffingNote)}</p>`:''}${a?.id==='relocate_teacher'?`<section class="notice relocation-contract"><h2>${esc(getRelocationContract(state)?.title)}</h2><p>${esc(getRelocationContract(state)?.summary)}</p></section>`:''}`;}
function reviewHistoryPanel(recordId=null,compact=false){
 const context=getReviewReadingContext(state,recordId);if(!context)return '';
 const h=context.history,settlement=context.settlement;
 return `<section class="notice review-history review-account" data-review-status="${esc(h.status)}"${recordId?` data-review-record="${esc(recordId)}"`:''}><h3>${esc(h.title)}</h3><div class="review-account-pages"><section class="review-result-page" data-review-result-page><header class="review-account-heading"><span class="review-account-mark" aria-hidden="true">Ⅰ</span><h4>${esc(context.resultHeading)}</h4></header>${context.resultNote?`<p class="review-account-note">${esc(context.resultNote)}</p>`:''}${context.results.map(row=>`<article class="review-result-row" data-review-result="${esc(row.eventId)}" data-review-result-status="${esc(row.status)}"><div class="review-result-heading"><strong>${esc(row.cellId)} · ${esc(row.label)}</strong><span class="review-result-status">${esc(row.statusLabel)}</span></div><p class="review-result-date">${row.status==='pending'?'约定':'记录于'}第${row.year}年</p><p>${esc(row.note)}</p></article>`).join('')}</section><section class="review-settlement-page" data-review-settlement-page="${esc(settlement.status)}"><header class="review-account-heading"><span class="review-account-mark" aria-hidden="true">Ⅱ</span><h4>${esc(settlement.label)}</h4></header><p class="review-settlement">${esc(settlement.summary)}</p></section></div>${recordId?`<p class="tiny review-account-explanation">${esc(h.explanation)}</p>`:''}${compact?'':`<details class="review-account-sources"><summary>核对各地复核与清点来源</summary>${h.detail.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="button-row">${h.sourceIds.filter(id=>id!==recordId).map((id,index)=>button(`查看复核或清点来源 ${index+1}`,'trace',`data-id="${esc(id)}"`,'text-button')).join('')}</div></details>`}</section>`;
}

function staffingHistoryPanel(e){if(!/^resolved:event:action:10:protagonist:D4:recruit_risk$/.test(e.id||''))return '';return `<section class="notice staffing-history"><h3>原始招募措辞与后续规则</h3><p>原始文字保留；其中通用的减产、停运表述，不单独证明某个档案站实际减产或停运。已发生的结果以原年度记录为准。</p><p>${esc(getStaffingRulesDescription(state))}</p></section>`;}
function relocationHistoryPanel(recordId){const h=getRelocationHistory(state,recordId);if(!h)return '';return `<section class="notice relocation-history" data-relocation-record="${esc(recordId)}" data-relocation-status="${esc(h.status)}"><h3>${esc(h.title)}</h3><p>${esc(h.explanation)}</p>${h.detail.map(t=>`<p>${esc(t)}</p>`).join('')}<div class="button-row">${h.sources.map((e,index)=>button(`查看迁任来源 ${index+1}`,'trace',`data-id="${esc(e.id)}"`,'text-button')).join('')}</div></section>`;}
function relocationDestinationPanel(cellId){const d=getRelocationDestination(state,cellId);if(!d)return '';return `<section class="notice relocation-destination" data-destination-cell="${esc(cellId)}" data-destination-status="${esc(d.status)}"><h2>${esc(d.title)}</h2><p>${esc(d.summary)}</p>${d.sources.length?`<p class="tiny">以下引用原地域的已存记录；原始地点、文字与来源链不变。</p><div class="button-row">${d.sources.map(source=>button(`查看 ${esc(source.cellId)} 原始迁任记录 · 第${source.year}年`,'trace',`data-id="${esc(source.recordId)}"`,'text-button')).join('')}</div>`:'<p class="tiny">来源不足，不补写个人经历或提供未核实的跳转。</p>'}</section>`;}
function feeOriginal(v){return v?`<details data-fee-original><summary>查阅原始条目（通用措辞，原文保留）</summary><h4>${esc(v.originalTitle)}</h4><p>${esc(v.originalText)}</p></details>`:'';}
function eventCard(e,compact=false,safeJournal=false,stage=null){const fd=feeRecordDisplay(state,e),review=getReviewHistory(state,e.id);return `<article${stage?` data-record-stage="${esc(stage.kind)}"`:""} class="event-card${stage?` record-stage-${esc(stage.kind)}`:""} ${e.status==='failed'?'failed':''}"><div class="event-meta">${tag(`第 ${e.year??e.dueYear??'—'} 年`)}${tag(e.cellId||'续史局')}${tag(e.kind==='simulation'?'模拟传播':e.kind==='action'?'玩家行动':'预设叙事 / 制度事件', 'quiet')}</div>${stage?`<p class="record-stage-label">${esc(stage.label)}</p>`:""}<h3>${esc(fd?.title||e.title||e.type||e.id)}</h3>${stage?`<p class="record-stage-note">${esc(stage.note)}</p>`:""}${!compact?`${review?`<p class="tiny review-original-label">${esc(review.originalLabel)}</p>`:''}<p>${esc(fd?.text||e.text||e.description||e.reason||'这条记录已保存在当前现实。')}</p>${feeOriginal(fd)}${reviewHistoryPanel(e.id)}${feeHistoryPanel(e.id)}${relocationHistoryPanel(e.id)}${staffingHistoryPanel(e)}${pendingBranchPanel(e)}`:''}<div class="button-row">${!safeJournal||journalSourceKnown(e.id)?button('追溯来源 ↗','trace',`data-id="${esc(e.id)}"`,'text-button'):'<p class="tiny">来源链缺失或不一致，暂不跳转。</p>'}${e.cellId?button(`定位 ${esc(e.cellId)}`,'locate',`data-cell="${esc(e.cellId)}"`,'text-button'):''}${visitButton(e.cellId)}</div></article>`;}
function header(){if(['avg','choice','confirm','window','playback','review'].includes(ui.screen))return `<header class="decision-header"><a href="#" data-action="home" class="decision-brand">余波</a><div class="top-actions">${button('档案','archive','','quiet-button')}${button('设置','settings','','quiet-button')}</div></header><p class="decision-location">第 ${state.year} 年 · R1 当前现实</p>`;const screenNames={world:'世界',list:'坐标目录',avg:'现场调查',visit:'只读现场回访',choice:'方案预览',confirm:'锁定审阅',window:'本轮安排',playback:'年度演变',review:'十年回顾',archive:'现实档案',trace:'因果追踪',ending:'阶段结局',settings:'设置与存档'};return `<header class="topbar"><a class="brand" href="#" data-action="home"><span class="brand-mark">余</span><span>余波<small>AFTERWAVE</small></span></a><div class="top-actions">${button('档案','archive','','quiet-button')}${button('设置','settings','','quiet-button')}</div></header>${ui.screen==='ending'?'':`<div class="era"><span class="era-year">第 <b>${state.year}</b> 年</span><span>${tag(state.phase==='planning'?'介入窗口':state.phase==='ended'?'阶段已归档':'年度演变',state.phase==='planning'?'gold':'')}<small>R1 当前现实 · ${screenNames[ui.screen]||'世界'}</small></span></div>`}`;}
function back(label='返回世界'){return button(`← ${label}`,'home','','back');}
function worldActorPicker(plan=null){
 const states={unassigned:'未安排',locked:'已锁草稿',passed:'已明确放弃',unknown:'草案待核对'};
 const list=plan?.actors||actors();
 return `<div class="actor-picker" role="group" aria-label="选择查看方案的角色">${list.map(a=>button(`<span class="world-actor-name">${esc(a.name)}</span>${plan?`<small class="world-actor-status" data-world-actor-status>${esc(states[a.draftStatus])} · ${a.localContractCount===null?'合同待核对':`${a.localContractCount}份合同`}</small>`:state.drafts[a.id]?' · 已安排':''}`,'actor',`data-actor="${esc(a.id)}" aria-pressed="${a.id===selectedActor().id}"`,a.id===selectedActor().id?'selected':'')).join('')}</div>`;
}
function worldPlanningStatus(plan){
 const a=plan.selectedActor,other=plan.otherActors.filter(role=>role.localContractCount>0);
 const budget=a.budgetStatus==='shared'?`${a.name}剩余 ${a.budget} / 3 调查轮。${plan.budgetNotice}`:a.budgetStatus==='per-scene'?plan.budgetNotice:'调查记录待核对，不把缺页当作零轮或新预算。';
 const draft=a.draftStatus==='locked'?`已锁「${a.draft.title}」· ${a.draft.cellId}，尚未提交。`:a.draftStatus==='passed'?'已明确放弃本窗口；只读方案不会撤回放弃。':a.draftStatus==='unknown'?'草案记录待核对，请核对本轮安排。':'';
 const alternate=a.localContractCount===0&&other.length?`${a.name}在此没有合同；${other.map(role=>`${role.name}有${role.localContractCount}份可阅读合同`).join('、')}。`:'';
 return `<p class="world-planning-status" data-world-planning-status role="status" aria-live="polite" aria-atomic="true">${[alternate,budget,draft,plan.notice].filter(Boolean).map(esc).join(' ')}</p>`;
}
function openingLetter(){const opening=getOpeningReadingContext(state);return opening?`<section class="opening-letter" data-opening-letter data-opening-record="${esc(opening.recordId)}" data-opening-source-id="${esc(opening.recordId)}" aria-label="第一次委托"><span class="eyebrow opening-letter-label">${esc(opening.label)}</span><h2>${esc(opening.title)}</h2><p>${esc(opening.body)}</p></section>`:'';}
function worldEntry(cell,available){
 const plan=getWorldPlanning(state,cell.id,selectedActor().id),alternate=plan?.primary.kind==='switch-scene'?plan.otherActors.find(a=>a.id===plan.primary.actorId):null;
 const label=state.phase==='playback'?'继续年度演变':state.phase==='ended'?'查看第40年结局':plan?.primary.kind==='unknown'?'核对本轮安排':alternate?`用${alternate.name}看 ${cell.id}`:available.length?`进入 ${cell.id} 现场`:`查看 ${cell.id} 历史`;
 const action=state.phase==='playback'?'playback':state.phase==='ended'?'ending':plan?.primary.kind==='unknown'?'window':alternate?'plan-as':available.length?'avg':'cell-history';
 const extra=alternate?` data-actor="${esc(alternate.id)}" aria-label="改由${esc(alternate.name)}免费查看 ${esc(cell.id)} 方案，不改已有草案"`:'';
 return `<section class="world-entry" aria-label="当前地域的下一步"><p id="world-entry-context" class="entry-context"><strong>${esc(cell.id)} · ${esc(cell.name)}</strong><span>${esc(selectedActor().name)}${state.phase==='planning'&&!available.length&&!alternate?plan?.primary.kind==='unknown'?' · 合同待核对':' · 本地无合同':''}</span></p>${button(label,action,`data-primary-action aria-describedby="world-entry-context"${extra}`,'primary')}${plan?worldActorPicker(plan):''}${openingLetter()}${plan?worldPlanningStatus(plan):''}</section>`;
}
function crisisMapLegend(){const view=getCrisisRegions(state);if(view.phase==='none')return '';return `<section class="crisis-map-legend" aria-label="危机地域记录图例"><strong>地域记录 · 与机构、派遣分开</strong><p>${esc(view.summary)}</p><ul>${view.legend.map(item=>`<li><span aria-hidden="true">${esc(item.symbol)}</span> ${esc(item.label)}</li>`).join('')}</ul><p>徽记不是建筑毁损或当前覆盖。未知不等于零损失。</p></section>`;}
function crisisMapSelection(cellId){const record=getCrisisRegions(state).regions.find(r=>r.cellId===cellId);if(!record)return '';return `<section class="crisis-map-selection" data-map-crisis-status="${esc(record.status)}"><h3>地图记录 · ${esc(cellId)}</h3><p>${esc(record.label)}</p>${record.detail.map(text=>`<p>${esc(text)}</p>`).join('')}${record.recordId?button('追查地图记录来源','trace',`data-id="${esc(record.recordId)}"`,'text-button'):''}</section>`;}
function world(){const phaseContext=getWorldPhaseContext(state);const cell=getCell(),available=actions(),visual=institutionVisual(state,cell.id);const inst=state.institutions.filter(i=>i.cellId===cell.id);const recent=state.history.slice(-1)[0];return `<div class="world-grid"><section class="world-main">${worldEntry(cell,available)}<div class="layer-tabs" role="group" aria-label="观察通道">${Object.keys(names).map(k=>button(`${symbols[k]} ${names[k]}`,'layer',`data-layer="${k}" aria-pressed="${ui.channel===k}"`,ui.channel===k?'selected '+k:k)).join('')}</div><div class="map-frame"><div class="map-caption"><span>${names[ui.channel]}影响 · 固定地理</span><span class="tiny">五档绝对能力</span></div><div class="heat-legend" aria-label="${names[ui.channel]}能力五档图例">${HEAT_BANDS.map((band,index)=>`<span><i style="background:${HEAT_PALETTES[ui.channel][index]}" aria-hidden="true"></i>${esc(band.label)}</span>`).join('')}</div><div id="board" role="img" aria-label="8乘8斜俯视世界地图。全部操作可使用下方坐标列表完成。"></div><div class="map-tools">${button('☷ 坐标列表','list')}${button(ui.focus?'返回全图':'聚焦 2.5×','focus')}</div></div>${crisisMapLegend()}<p class="hint">地图只预选。每十年，每人一次介入。</p><p class="map-activity-legend">□ 主角 · ○ 林澈：拟派遣（未提交）<br>⌛ 待兑现（不是现存机构）</p><section class="selection-card"><div class="section-heading"><div><span class="eyebrow">SELECTED REGION</span><h2>${esc(cell.id)} <span>${esc(cell.name==='未命名地域'?'无名河岸':cell.name)}</span></h2></div>${tag(available.length?'可介入':'可查看',available.length?'gold':'')}</div>${channels(cell)}${state.staffingRulesVersion===undefined?staffingPolicyPanel():''}${state.branchAccessRulesVersion===undefined&&['D4','F6'].includes(cell.id)?branchPolicyPanel():''}${visual?`<p class="institution-status">${esc(visual.label)}</p>`:''}${mapActivity(state,cell.id).length?`<ul class="map-activity" aria-label="本地域的拟派遣与待兑现合同">${mapActivity(state,cell.id).map(a=>`<li>${esc(a.label)}</li>`).join('')}</ul>`:''}${state.events.filter(e=>e.cellId===cell.id&&e.actionId==='branch'&&e.status==='pending').map(e=>pendingBranchPanel(e)).join('')}${crisisMapSelection(cell.id)}${coveragePanel(cell.id)}${localCrisisPanel(getLocalCrisisRecord(state,cell.id),true)}<p>${inst.length?inst.map(i=>esc(i.name||i.title||i.type||'当地制度')).join(' · '):cell.id==='D4'?'旧档案室里，两本账册记录着不同的损失。':'这里也参与每一年四通道的演化。'}</p>${getWorldPlanning(state,cell.id,selectedActor().id)?'':worldActorPicker()}<div class="button-row">${button('地域历史','cell-history','','text-button')}${button('现实比较','archive','','text-button')}${visitButton(cell.id)}</div></section></section><aside class="world-side"><section class="chapter-note"><span class="eyebrow">${state.phase==='ended'?'STAGE COMPLETE':`CHAPTER ${Math.min(4,Math.floor(state.year/10)+1)} / 04`}</span><h2>${esc(sceneFor(state,'D4').title)}</h2><p>${esc(sceneFor(state,'D4').question)}</p><div class="decade-track">${[0,10,20,30,40].map(y=>`<span class="${state.year>=y?'past':''}">${y}<i></i></span>`).join('')}</div></section><section class="window-card" data-world-phase="${esc(phaseContext?.kind||"unknown")}"><h3>${esc(phaseContext?.title||"当前阶段待核对")}${phaseContext?.showDraftCount?` <span data-world-draft-count>${Object.keys(state.drafts).length}/${actors().length}</span>`:""}</h3><p>${esc(phaseContext?.description||"阶段信息不足，请先核对已存记录。")}</p>${button(state.phase==='planning'?'核对本轮安排 →':'查看已提交历史 →',state.phase==='planning'?'window':'archive','','secondary')}${getPlaybackJournal(state)?.isBoundary?button('重读刚结束的十年','review','','text-button'):''}</section>${state.year===0?`<section class="letter"><span class="eyebrow">一封未寄出的信</span><p>“亲自去一个地方。<br>不要只改变报告里的数字。”</p><small>续史局 · 第一次委托</small></section>`:recent?eventCard(recent,true):''}<p class="footnote">设计参数是可调的原型假设，并非真实历史预测。</p></aside></div>`;}
function list(){const crisis=getCrisisRegions(state),crisisByCell=new Map(crisis.regions.map(r=>[r.cellId,r]));const filtered=state.cells.filter(c=>{const match=`${c.id}${c.name}`.toLowerCase().includes(ui.query.toLowerCase());const available=getActions(state,c.id,selectedActor().id).length;const hasEvents=state.history.some(e=>e.cellId===c.id);return match&&(ui.filter==='all'||ui.filter==='action'&&available||ui.filter==='history'&&hasEvents||ui.filter==='risk'&&crisisByCell.has(c.id));});return `<section class="page narrow">${back()}<span class="eyebrow">ALL 64 REGIONS</span><h1>每一个地方，都在历史里。</h1><p class="muted">与地图共享同一选择。打开任何一格，可查看通道、历史、现实比较与合法介入。</p><label class="search-label">搜索坐标或地名<input id="search" type="search" placeholder="例如 D4、河港" value="${esc(ui.query)}"></label><div class="filter-tabs">${[['all','全部'],['action','可介入'],['history','有余波'],['risk',crisis.filterLabel]].map(([id,n])=>button(n,'filter',`data-filter="${id}" aria-pressed="${ui.filter===id}"`,ui.filter===id?'selected':'')).join('')}</div><p role="status">显示 ${filtered.length} / 64 格 ${button('恢复全部','reset-filter','','text-button')}</p>${ui.filter==='risk'?`<p class="crisis-map-summary">${esc(crisis.summary)}</p>`:''}<div class="coordinate-list">${filtered.map(c=>`<button class="coordinate-row" data-action="select" data-cell="${c.id}"><b>${c.id}</b><span><strong>${esc(c.name==='未命名地域'?'无名河岸':c.name)}</strong><small>${getActions(state,c.id,selectedActor().id).length?'可介入':'可查看'} · ${names[ui.channel]} ${c.channels[ui.channel].toFixed(1)}</small>${crisisByCell.has(c.id)?`<small class="crisis-map-row">${esc(crisisByCell.get(c.id).label)}</small>`:''}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></section>`;}
function visitButton(cellId){return getSceneVisit(state,cellId)?.available?button(`${esc(cellId)} · 只读现场回访`,'visit',`data-cell="${esc(cellId)}"`,'text-button'):'';}
function sceneArtDetail(art){
 const detail=art.detail;if(!detail)return '';
 return `<figure class="scene-art-detail" data-mandate-art="${esc(detail.status)}"><img src="${import.meta.env.BASE_URL}assets/${esc(detail.file)}" alt="${esc(detail.alt)}" width="1000" height="390" data-intrinsic-detail-size><figcaption>${esc(detail.caption)}</figcaption></figure>`;
}
function visitCards(v){
 if(!v.cards?.length)return '';
 const states={current:{label:'此刻',time:`第 ${v.year} 年 · 当前状态`,mark:'●'},recorded:{label:'已发生',time:`截至第 ${v.year} 年 · 已存记录`,mark:'◆'},pending:{label:'待兑现',time:'已提交 · 尚未兑现',mark:'○'},unknown:{label:'未知',time:'记录不足 · 不补写结论',mark:'?'}};
 return `<section class="visit-records" aria-label="当前服务、合同与已发生后果"><div class="visit-records-heading"><span class="eyebrow">RETURN TO THE PLACE</span><h2>留下的服务与责任</h2><p>当前现场、已经发生的结果与待兑现合同分开阅读。</p></div>${v.cards.map(card=>{const status=Object.hasOwn(states,card.status)?card.status:'unknown',meta=states[status];return `<article class="visit-record" data-visit-card="${esc(card.id)}" data-visit-status="${status}"><header class="visit-record-heading"><span class="visit-record-mark" aria-hidden="true">${meta.mark}</span><div><p class="visit-record-time">${esc(meta.time)}</p><h3>${esc(card.title)}</h3></div><span class="visit-record-status">${meta.label}</span></header><div class="visit-record-body">${card.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div>${card.sourceIds?.length?`<div class="visit-record-sources">${card.sourceIds.map((id,index)=>button(`查看本项来源 ${index+1}`,'trace',`data-id="${esc(id)}" aria-label="${esc(card.title)} · 查看已存来源 ${index+1}"`,'text-button')).join('')}</div>`:''}</article>`;}).join('')}</section>`;
}
function visit(){
 const v=getSceneVisit(state,ui.selected);
 if(!v?.available)return `<section class="page narrow">${back()}<h1>没有可回访的现场。</h1><p>请回到世界选择可回访的地域。</p></section>`;
 const art=v.art;
 return `<section class="page reading scene-visit" data-visit-cell="${esc(v.cellId)}">${sceneSourceReturnPanel()}${readingReturnButton()}${endingReturnButton()}${back()}<div class="reading-meta">${tag(`${v.cellId} · 第 ${v.year} 年`)}${tag('只读 · 当前现实')}</div><h1>${esc(v.title)}</h1><p class="notice">${esc(v.notice)}</p><div class="scene-art${art.captionBelow?' caption-below':''}${art.composite?' scene-art-composite':''}"><img src="${import.meta.env.BASE_URL}assets/${esc(art.file)}" alt="${esc(art.alt)}" width="1000" height="${art.composite?1018:500}" data-intrinsic-visit-size><span>${esc(art.caption)}</span></div>${sceneArtDetail(art)}<div class="prose">${v.summary.map(p=>`<p>${esc(p)}</p>`).join('')}</div>${visitCards(v)}${localCrisisPanel(art.history||getLocalCrisisRecord(state,v.cellId))}<section class="scene-visit-sources"><h2>现场的已存来源</h2>${v.sourceIds.length?v.sourceIds.map((id,index)=>button(`查看现场来源 ${index+1}`,'trace',`data-id="${esc(id)}"`,'text-button')).join(''):'<p>没有可核实的当地行动来源；不补写过去。</p>'}</section><div class="button-row">${button('查看地域历史','cell-history','','secondary')}${back()}</div></section>`;
}
// A free index into the existing full contract cards, never an extra action.
function sceneChoiceDirectory(available,investigation){
 if(!available.length)return '';
 const budget=Number.isInteger(investigation?.budget)&&investigation.budget>=0&&investigation.budget<=3?`剩余 ${investigation.budget} / 3 调查轮`:'调查余额待核对';
 const fork=getSuccessionChoiceFork(state,ui.selected,selectedActor().id),crisis=getCrisisChoiceFork(state,ui.selected,selectedActor().id),policy=getPolicyChoiceFork(state,ui.selected,selectedActor().id);
 return `<nav class="scene-choice-directory${fork?' succession-fork-directory':''}${crisis?' crisis-fork-directory':''}${policy?' policy-fork-directory':''}" data-scene-choice-directory${fork?' data-succession-fork':''}${crisis?' data-crisis-fork':''}${policy?' data-policy-fork':''} aria-label="定位完整合同"><p class="scene-choice-directory-label">合同目录 · 只读定位</p><p class="scene-choice-directory-meta">${esc(selectedActor().name)} · ${esc(budget)}</p><p class="scene-choice-directory-note">${fork?'每人每窗口一项。下列为若合同兑现的安排，定位不取证、不锁定。':crisis?'每人每窗口一项。以下是当前合同条件，尚非已发生结果。定位不取证、不锁定。':'每人每窗口一项。定位不取证、不锁定。'}</p><div class="scene-choice-links">${available.map(a=>{const successionDetail=renderSuccessionForkDetail(fork?.choices.find(c=>c.actionId===a.id)),crisisDetail=renderCrisisForkDetail(crisis?.choices.find(c=>c.actionId===a.id)),policyDetail=renderPolicyForkDetail(policy?.choices.find(c=>c.actionId===a.id)),detail=successionDetail||crisisDetail||policyDetail;return button(`<span>${esc(a.title)}</span>${policyDetail&&a.id===available[0].id?renderPolicyForkTiming(policy):''}${detail}<span aria-hidden="true">↓</span>`,'scene-choice',`data-id="${esc(a.id)}" aria-label="免费定位完整合同：${esc(a.title)}"${detail?` aria-describedby="${policyDetail?'policy-fork-timing ':''}${policyDetail?'policy':crisisDetail?'crisis':'succession'}-fork-${esc(a.id)}"`:''}`,'scene-choice-link'+(successionDetail?' succession-choice-link':crisisDetail?' crisis-choice-link':policyDetail?' policy-choice-link':''));}).join('')}</div></nav>`;
}
function successionContextPanel(cellId='D4',actorId='protagonist'){
 const context=getSuccessionSceneContext(state,cellId,actorId);
 return context?`<aside class="succession-context" data-succession-context><h2>${esc(context.title)}</h2>${context.body.map(p=>`<p>${esc(p)}</p>`).join('')}</aside>`:'';
}
function buildingComparisonSummary(available,investigation){
 const options={cellId:ui.selected,actorId:selectedActor().id,legacyEvidence:investigation.evidence};
 const contracts=available.map(a=>({a,contract:getBuildingContract(state,a.id,options)})).filter(row=>row.contract);
 if(!contracts.length)return '';
 return `<section class="building-comparison-summary" aria-labelledby="building-comparison-title" data-building-comparison><h2 id="building-comparison-title">三种建站 · 并列核对</h2><p>每人每窗口一项。以下是合同条件，尚未兑现；查看不取证、不锁定。</p><p class="building-common-terms" data-comparison-common-terms><strong>三种方案共同的失败结果</strong>到期都只判定一次；若失败，仍在D4留下小型档案站，已付成本不退，原教学与分站链不启动。</p><div class="building-comparison-grid">${contracts.map(({a,contract})=>`<article data-comparison-action="${esc(a.id)}"><h3>${esc(a.title)}</h3><dl><div><dt>提交成本与名额</dt><dd>${esc(costText(a.cost))}；本窗口 1 次介入</dd></div><div><dt>结果与发生时间</dt><dd>${esc(chanceText(a))}</dd></div><div><dt>若合同兑现</dt><dd>${esc(contract.displayReward)}</dd></div><div><dt>仍需承担</dt><dd>${esc(contract.displayRisk)}</dd></div></dl>${button('定位完整方案','scene-choice',`data-id="${esc(a.id)}" aria-label="定位完整方案：${esc(a.title)}"`,'secondary')}</article>`).join('')}</div></section>`;
}
function avg(){
 const art=sceneArt(state,ui.selected),actor=selectedActor().id;
 const s=sceneFor(state,ui.selected,actor),crisisContext=getCrisisSceneContext(state,ui.selected,actor),ses=session(),refusals=getActorRefusals(state,actor,ui.selected);
 const trainingComparison=getTrainingChoiceComparison(state,ui.selected,actor);
 const evidenceIds=getEvidenceIds(state,ui.selected,actor),available=actions();
 if(trainingComparison){const order=trainingComparison.options.map(option=>option.actionId);available.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):order.length)-(order.includes(b.id)?order.indexOf(b.id):order.length));}
 const plan=getInvestigationPlan(state,ui.selected,actor),intent=plan?investigationIntentFor(state,ui.selected,actor):null,crossLocation=plan?getCrossLocationInvestigation(state,ui.selected,actor):null;
 const past=localCrisisPanel(art.history||getLocalCrisisRecord(state,ui.selected));
 const free=available.filter(a=>!(a.requireEvidence||[]).length);
 const buildingChoices=getBuildingContract(state,'build_joint',{cellId:ui.selected,actorId:actor,legacyEvidence:ses.evidence});
 const choices=`<section class="choices" data-planning-choices><div class="section-heading"><h2 data-scene-section="choices" tabindex="-1">方案与取舍</h2>${button('回读现场','scene-section','data-section="story"','text-button')}</div>${renderChoiceAgency(refusals)}${sceneChoiceDirectory(available,ses)}<span class="eyebrow">你想留下什么规则？</span>${plan?renderInvestigationBudget(plan):''}${intent?.question?`<p class="planning-question">${esc(intent.question)}</p>`:''}<p class="contract-preview-hint">先免费读合同，再决定调查什么。阅读不消耗轮次，也不锁定任务。</p>${renderPlanningOpportunity(getPlanningOpportunity(state,{actorId:actor,cellId:ui.selected}))}${renderTrainingChoiceComparison(trainingComparison)}${buildingChoices?'<p class="building-common-terms" data-building-common-terms><strong>三种建站方案共同承担</strong>三种方案都承担失败不退款与后续维护。原教学与分站链须建站成功、各步来源仍运转才接续；续约另需一次介入。逐项条件见各方案合同。</p>':''}${available.map(a=>{
  const missing=(a.requireEvidence||[]).filter(id=>!ses.evidence.includes(id)),research=plan?.actions.find(item=>item.actionId===a.id),buildingTradeoff=getBuildingCardTradeoff(state,a.id,{cellId:ui.selected,actorId:actor,legacyEvidence:ses.evidence}),tradeoff=buildingTradeoff||getActionCardTradeoff(a),relocation=a.id==='relocate_teacher'?getRelocationContract(state):null;
  return `<button class="choice-card${buildingTradeoff?' building-choice-card':''}${missing.length?' needs-evidence':''}${research&&!research.reachable?' research-unreachable':''}" data-action="choose" data-id="${a.id}" data-needs-evidence="${missing.length>0}"><span class="choice-title">${esc(a.title)} <i>↗</i></span><span>${tradeoff?`<span class="choice-card-tradeoff">${tradeoff.map(row=>`<span data-card-tradeoff="${esc(row.field)}"><strong>${esc(row.label)}：</strong>${esc(row.known?row.text:'当前合同未记明，暂不推断。')}</span>`).join('')}${relocation?`<span class="choice-card-scope" data-card-relocation-scope><strong>去向与制度范围：</strong>${relocation.detail.slice(0,2).map(text=>`<span class="choice-card-scope-line">${esc(text)}</span>`).join('')}</span>`:''}</span>`:esc(a.description)}</span>${renderTeachingTiming(getTeachingTimingContext(state,{actorId:actor,cellId:ui.selected,actionId:a.id}),'card')}<span class="choice-cost">${esc(costText(a.cost))} · ${esc(chanceText(a))}</span>${research?renderActionResearch(research,plan.budget):missing.length?`<small>可免费预览 · 锁定尚需：${missing.map(id=>esc(evidenceTitleFor(state,id,ui.selected,actor))).join('、')}</small>`:''}</button>`;
 }).join('')}</section>`;
 const materials=`<section class="evidence-panel" data-planning-materials><div class="section-heading"><h2 data-scene-section="materials" tabindex="-1">现场取证</h2>${button('回看方案','scene-section','data-section="choices"','text-button')}<span class="tag" role="status" aria-live="polite" aria-atomic="true">剩余 ${ses.budget} / 3 轮</span></div><p class="muted investigation-rule">${usesTradeoffs(state)?'每角色每窗口共用3轮，换地点不补充。展开材料先看用途；点击调查才花轮数。':'每份材料消耗1轮；沿用旧版每现场预算。'} 返回与重读不会重置。</p>${free.length?`<p class="local-no-evidence">本地无需取证的方案：${free.map(a=>esc(a.title)).join('、')}。费用与其他条件仍须核对。</p>`:''}${evidenceIds.map(id=>{
  const done=ses.evidence.includes(id),material=plan?.materials.find(item=>item.id===id),purpose=intent?.evidence.find(item=>item.id===id);
  return `<details class="evidence${material?' planned-evidence':''}" data-evidence-id="${id}" ${done?'open':''}><summary>${material?renderMaterialSummary(material,plan,purpose):`${done?'✓ ':''}${esc(evidenceTitleFor(state,id,ui.selected,actor))}`}</summary>${done?`<p>${esc(evidenceFor(state,id,ui.selected,actor).text)}</p>`:`${material?renderMaterialDecision(material,plan,purpose):'<p>取证后可阅读完整材料；不一定用于本地当前方案。</p>'}${renderCrossLocationInvestigation(crossLocation,id)}${button(`调查这份材料 · ${evidenceCost(state,id)}轮`,'evidence',`data-id="${id}" ${ses.budget<evidenceCost(state,id)?'disabled':''}`)}`}${evidenceBookmarkMarkup(id)}</details>`;
 }).join('')}</section>`;
 return `<section class="page reading scene-planning-page">${back()}<div class="reading-meta">${tag(`${ui.selected} · 第 ${state.year} 年`)}${tag(selectedActor().name)}${tag('尚未提交','gold')}</div><nav class="scene-reading-nav" aria-label="现场阅读导航">${button('先看方案 · 免费','scene-section','data-section="choices"','primary')}${button('查看取证用途','scene-section','data-section="materials"','secondary')}<p>跳转不调查、不改安排；故事和材料仍完整保留。</p></nav>${buildingChoices?buildingComparisonSummary(available,ses):''}<div class="scene-art${art.captionBelow?' caption-below':''}"><img src="${import.meta.env.BASE_URL}assets/${art.file}" alt="${esc(art.alt)}" width="1000" height="500" data-intrinsic-scene-size><span>${esc(s.subtitle)} · ${esc(art.caption)}</span></div>${sceneArtDetail(art)}<div class="prose scene-testimony"><header class="scene-voice-heading" data-scene-voice-heading><span class="eyebrow">${esc(s.speaker)}</span><h1 data-scene-section="story" tabindex="-1">${esc(s.title)}</h1></header>${s.body.map(p=>`<p>${esc(p)}</p>`).join('')}${s.relationship?`<section class="notice relationship-response"><h2>${esc(s.relationship.title)}</h2><p>${esc(s.relationship.text)}</p><div class="button-row">${s.relationship.sources.map(id=>button('查看这段关系的实际来源','trace',`data-id="${esc(id)}"`,'text-button')).join('')}</div></section>`:''}${crisisContext?.body.map(p=>`<p data-crisis-scene-context>${esc(p)}</p>`).join('')||''}<p class="question"${crisisContext?' data-crisis-scene-question':''}>${esc(crisisContext?.question||s.question)}</p></div><div class="scene-story-return">${button('回看方案与取舍 · 免费','scene-section','data-section="choices"','secondary')}</div>${successionContextPanel(ui.selected,actor)}${relocationDestinationPanel(ui.selected)}${refusals.map(r=>`<section class="notice actor-refusal"><h2 data-actor-agency-target="reason" tabindex="-1">${esc(r.title)}</h2><p data-actor-refusal-reason>${esc(r.reason)}</p><p>这项立场只约束她自己的执行，不替主角作决定。查看理由不消耗调查、不扣费，也不占用本窗口名额；可以选择其余行动或明确放弃。</p>${r.sourceEventId?button('查看当年的入局承诺','trace',`data-id="${esc(r.sourceRecordId||r.sourceEventId)}"`,'text-button'):''}<button class="text-button actor-agency-return" data-actor-agency-link="summary">返回方案旁的立场提示</button></section>`).join('')}${choices}${investigationComparisonPanel()}${materials}${past?`<details class="planning-history"><summary>回看第23年已存清点 · 不改变当前选择</summary>${past}</details>`:''}${button('核对本轮安排','window','','secondary')}</section>`;
}
// Decision stages share the same contract, but do not make players reread the
// full source dossier just to save a reversible draft. No game state is written.
function buildingResponsibility(a,options){
 const h=getBuildingContract(state,a?.id,options);if(!h)return '';
 return `<section class="notice building-responsibility" data-contract-material-risk><h2>失败与后续责任</h2><p>第${h.dueYear}年只判定一次。失败留下D4小型档案站，成本不退，原教学与分站链不启动。</p><p>若建站成功，且各步来源仍运转，第7年接续E4、D5教学，第12年接续F6分站。${esc(h.futureBranchAccess.description)}</p><p>测站续约另占第10年的1次介入、经济3，第11年兑现。未续约且未先停运，第16年维护降至0.70并收费。继任不能代替续约；缺人手可能先减产并在第16年停运。</p><p>${h.model==='legacy-overall'?'本局保留旧版整体危机公式，不追加治理来源保护。':h.coverage?.sourceProtection>0?'来源保护不能替代完整复核。':'商会方案不附加治理来源保护。'}未来载体仍须实际运转。</p></section>`;
}
function contractFields(a,options){
 return `<dl class="contract" data-contract-core><div><dt>提交成本与名额</dt><dd>${esc(costText(a.cost))}；本窗口 1 次介入</dd></div><div><dt>结果与发生时间</dt><dd>${esc(chanceText(a))}</dd></div><div><dt>值得争取的结果</dt><dd>${esc(actionClaim(a,'reward',options))}</dd></div><div data-contract-material-risk><dt>风险、代价与维护</dt><dd>${esc(actionClaim(a,'risk',options))}</dd></div></dl>`;
}
function contractSources(a,options,{includeModel=true}={}){
 return `${renderLocalCostLedger(getLocalCostLedger(state,options.cellId,a))}${includeModel&&a.modelNote?`<dl class="contract-model"><div><dt>合同条件与原型假设</dt><dd>${esc(a.modelNote)} 参数可调，尚未经过真人平衡验证。</dd></div></dl>`:''}`;
}
function draftChoiceComparison(){
 if(!draftEdit)return '';
 const actorId=selectedActor().id,view=getDraftChoiceComparison(state,{actorId,cellId:ui.selected,actionId:ui.choice,legacyEvidence:session().evidence});
 if(!view)return '';
 const original=view.original,candidate=view.candidate;
 const fields=(side)=>{
  const a=renewalDisplay(state,side.action,side.cellId),options={cellId:side.cellId,actorId,legacyEvidence:side.evidence||session().evidence};
  if(!a)return {cost:'明确放弃本窗口，不支付介入成本。',time:'没有待兑现的合同。',reward:'不新增这位角色的介入；现存制度仍会继续演化。',risk:'本窗口不安排这位角色，既有维护缺口与危机不会因此消失。',responsibility:'保留明确放弃，不占用另一角色的安排。'};
  return {cost:`${costText(a.cost)}；本窗口 1 次介入`,time:chanceText(a),reward:actionClaim(a,'reward',options),risk:actionClaim(a,'risk',options),responsibility:[getActionResponsibility(a.id),a.staffingNote,a.modelNote].filter(Boolean).join(' ')};
 };
 const old=fields(original),next=fields(candidate);
 const evidenceNote=original.status==='passed'?'原安排是明确放弃，没有锁定合同或合同证据。备选按当前已取得材料读取。':view.evidenceChanged?'这是同一合同，但已取得材料发生变化：原安排仍沿用锁定时证据，备选读取当前材料。只有明确重新锁定才纳入新材料。':'原安排沿用锁定时证据，备选按当前已取得材料读取。免费比较不会取得未读材料。';
 return renderDraftChoiceComparison({actorName:view.actorName,original:{title:original.title,location:original.cellId?`${original.cellId} · 原锁定地点`:'本窗口明确放弃'},candidate:{title:candidate.action.title,location:`${candidate.cellId} · 当前备选地点`},evidenceNote,rows:[['cost','提交时的当地成本与名额'],['time','发生时间与判定'],['reward','值得争取的结果'],['risk','风险与代价'],['responsibility','责任与条件边界']].map(([id,label])=>({id,label,original:old[id],candidate:next[id]}))});
}
function choice(confirm=false){
 const actor=selectedActor().id,preview=getActionPreview(state,ui.selected,actor,ui.choice,session().evidence),a=renewalDisplay(state,preview?.action,ui.selected);
 if(!a){ui.screen='avg';return avg();}
 const plan=getInvestigationPlan(state,ui.selected,actor),research=plan?.actions.find(item=>item.actionId===a.id),copy=getDecisionStageCopy(confirm?'confirm':'preview',state);
 const options={cellId:ui.selected,actorId:actor,legacyEvidence:session().evidence},building=!!getBuildingContract(state,a.id,options);
 const context=actionContext(a,options),technicalModel=building||a.id==='authorize_training';
 const lockLabel=preview.canLock?(confirm?copy.primaryLabel:'继续核对这项任务'):research&&!research.reachable?'本窗口取证不足，不能锁定':'尚缺证据，不能锁定';
 return `<section class="page narrow decision-page" data-decision-stage="${confirm?'confirm':'preview'}"><span class="eyebrow">${esc(copy.eyebrow)}</span><h1>${esc(a.title)}</h1><div class="reading-meta">${tag(`${ui.selected} · 第 ${state.year} 年`)}${tag(selectedActor().name)}</div><p class="decision-status">${esc(copy.status)}</p>${confirm?button('← 返回方案','choose',`data-id="${esc(a.id)}"`,'back'):button('← 返回现场','avg','','back')+(sceneReturn?'':button('回到这份方案','resume-contract',`aria-label="回到现场方案：${esc(a.title)}，继续比较"`,'text-button contract-resume-link'))}${confirm&&state.drafts[actor]?'<p class="notice draft-replacement">锁定后替换此角色原有的本轮安排；尚未提交。</p>':''}${confirm?'':`<p class="lead">${esc(a.description)}</p>`}${confirm?'':`<p class="notice contract-readonly">${esc(copy.summary)}</p>`}${contractFields(a,options)}${renderTeachingTiming(getTeachingTimingContext(state,{actorId:actor,cellId:ui.selected,actionId:a.id}))}${confirm&&building?buildingResponsibility(a,options):''}${draftChoiceComparison()}${renderPlanningOpportunity(getPlanningOpportunity(state,{actorId:actor,cellId:ui.selected,actionId:a.id}))}${renderRoleReadingChoice(getRoleReadingChoice(state,{actorId:actor,cellId:ui.selected,actionId:a.id}))}${confirm&&preview.canLock&&research?`<div class="contract-research" data-contract-research data-research-reachable="${research.reachable}">${renderActionResearch(research,plan.budget)}</div>`:renderContractResearch(research,plan)}${!confirm&&['independent_review','local_veto'].includes(a.id)?investigationComparisonPanel():''}${contractSources(a,options,{includeModel:!confirm||!technicalModel})}${confirm?`${a.staffingNote?`<p class="notice staffing-contract">${esc(a.staffingNote)}</p>`:''}${a.id==='relocate_teacher'?`<section class="notice relocation-contract"><h2>${esc(getRelocationContract(state)?.title)}</h2><p>${esc(getRelocationContract(state)?.summary)}</p></section>`:''}${technicalModel?`<details class="decision-details" data-confirm-contract-details><summary>${building?'完整责任与数值':'逐项年度来源与依据'}</summary>${building?context:''}${a.modelNote?`<p>${esc(a.modelNote)}</p>`:''}</details>`:''}<p class="decision-responsibility">${esc(getActionResponsibility(a.id))}</p>`:context}<div class="notice decision-caution"><p>${esc(copy.caution)}</p></div>${preview.missing.length&&!plan?`<section class="notice missing-evidence" role="status"><h2>锁定仍需实际取证</h2><p>${preview.missing.map(id=>esc(evidenceTitleFor(state,id,ui.selected,actor))).join('、')}</p><p>查看取证入口不消耗轮次；点击调查才读取材料。</p>${button('返回现场查看取证入口','preview-evidence',`data-id="${esc(preview.missing[0])}"`,'secondary')}</section>`:''}<div class="review-actions" data-review-actions>${button(lockLabel,confirm?'lock':'confirm',preview.canLock?'':'disabled','primary')}${confirm?button(copy.backLabel,'choose',`data-id="${esc(a.id)}"`,'secondary'):button('回到这份方案','avg',`data-resume-contract aria-label="回到现场方案：${esc(a.title)}，继续比较"`,'secondary')}</div></section>`;
}
function investigationComparisonPanel(){const view=getInvestigationComparison(state,ui.selected,selectedActor().id);return renderComparisonGuidance(getComparisonGuidance(view))+renderInvestigationComparison(view);}
function crisisOutlookPanel(){
 const risk=getCrisisOutlook(state);if(!risk)return '';
 const number=n=>Number(n).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
 const attempts=risk.attempts.map(a=>`<li>${esc(state.actors.find(actor=>actor.id===a.actorId)?.name||a.actorId)} · ${esc(a.cellId)}复核：${Math.round(a.probability*100)}%，第${a.dueYear}年判定一次。</li>`).join('');
 if(!risk.ready)return `<section class="notice crisis-outlook"><h2>第23年 · 本轮风险对照</h2><p>安排未齐、有冲突或尚有未确定的既有合同，暂不能给出完整条件推算。</p><ul>${risk.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>${attempts?`<ul>${attempts}</ul>`:''}</section>`;
 return `<section class="notice crisis-outlook"><h2>第23年 · 本轮风险对照</h2><p>这是已锁定方案的条件推算，尚未提交或兑现。损失系数不是伤亡比例。</p>${attempts?`<ul class="review-attempts">${attempts}</ul>`:'<p>本轮没有锁定交叉复核。</p>'}<p class="fallback-summary">${risk.vetoBase<1?`停闸后备：基数${risk.vetoBase.toFixed(2)}，采用较强的一份。`:'未安排停闸后备，未被复核纠正时基数仍为1。'}${risk.guaranteedReview?' 按本局合同，复核确定完成；停闸不再额外降低本次损失。':''}</p>${risk.success.available?`<p class="success-branch"><strong>${risk.guaranteedReview?'按合同确定完成复核':'任一复核及时完成'}：</strong>四地本次共同失效损失系数为0。洪水仍会到来。</p>`:''}${risk.fallback.possible?`<p class="failure-branch"><strong>${risk.attempts.length?'若所有复核均未及时完成':'未修正共同标准'}：</strong>${risk.legacy?'整体':'四地平均'}损失系数${number(risk.fallback.damage)}${risk.vetoBase<1?'，停闸后备仍生效':'，仅靠地方预警与互助减轻损失'}。</p>`:''}${risk.legacy?'<p>旧档整体规则：免费预警×0.80、互助×0.70；没有逐地记录，不补造分区明细。</p>':`<div class="risk-regions">${risk.regions.map(r=>`<article data-risk-cell="${r.cellId}"><h3>${r.cellId}</h3><p>预警覆盖：当前${r.currentCoverage.toFixed(2)} → 合同兑现后${r.coverage.toFixed(2)}</p><p>来源保护${r.protection.toFixed(2)} · ${r.aid?'当地互助×0.70':'无当地互助保护'}</p>${risk.fallback.possible?`<p>未完成复核时损失：<strong>${number(risk.fallback.damageByCell[r.cellId])}</strong></p>`:''}</article>`).join('')}</div>`}<details><summary>推算的边界与依据</summary>${risk.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</details></section>`;
}
function handoffOutlookPanel(){
 const view=getHandoffOutlook(state);if(!view)return '';
 const namesByActor=Object.fromEntries(state.actors.map(a=>[a.id,a.name]));
 const policyLabel={share_power:'共享纠错权',withdraw:'结束独占控制',central_review:'集中协调'};
 const capability=(c,title,kind)=>`<article class="handoff-capability" data-handoff-stage="${kind}"><h3>${title}</h3><p>承接人手：<strong>${esc(c.staffCells.join('、')||'无')}</strong>${view.model==='legacy'?` · 旧规则累计网络${c.networks}`:''}</p>${c.authorizedCells?`<p>地方授权：${esc(c.authorizedCells.join('、')||'无')}</p>`:'<p>旧档不采用新版本的授权判定。</p>'}<p>异源校验：${esc(c.checkCells.join('、')||'无')}</p>${c.links?`<p>跨地承接：${c.links.length?esc(c.links.map(l=>`${l.staffCell} → ${l.checkCell}`).join('；')):'尚未形成'}</p>`:`<p>旧规则独立能力：${c.autonomy}</p>`}<p>河港信任：${c.trust?'有合作记录':'尚无合作或明确拒绝'}</p><p class="command-check-status" data-command-check="${c.commandCheck===true}">未来指令校验：<strong>${c.commandCheck?(kind==='projected'&&!view.current.commandCheck?'本组条件落实后可用':'按本局记录已有校验'):'尚无完成来源'}</strong>。保档支点与已完成的指令比对分别核对。</p><p class="handoff-policy-status">${c.policyStatus==='no-policy'?'本轮未锁定交班方针；有能力不等于已作出交班决定。':c.policyStatus==='central'?'本轮选择集中协调，不是共享或退出；仍需真实指令复核，不能只凭培训或保档认定安全。':c.policyStatus==='share-ready'?'按这一组条件，共享所需承接与信任齐备。':c.policyStatus==='withdraw-ready'?'按这一组条件，退出所需承接能力齐备。':'按这一组条件，所选交班方针仍有缺口。'}</p>${(view.policy?.actionId==='share_power'?c.shareMissing:c.missing).length?`<ul>${(view.policy?.actionId==='share_power'?c.shareMissing:c.missing).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}</article>`;
 if(!view.ready)return `<section class="notice handoff-outlook"><h2>第30年 · 整轮交班对照</h2><p>先完成全员安排并解决冲突，再对照已锁合同。现在不预测未锁定的选择。</p><ul>${view.issues.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`;
 return `<section class="notice handoff-outlook"><h2>第30年 · 整轮交班对照</h2><p>当前与按已锁定合同兑现后的条件分开列出。尚未支付或兑现，也不保证第40年的结局。</p><p>本轮方针：<strong>${esc(view.policy?policyLabel[view.policy.actionId]:'未锁定')}</strong>。</p><div class="handoff-comparison">${capability(view.current,'当前能力','current')}${capability(view.projected,(view.authorizationConditional?.length||view.conditional.some(c=>c.supported))?'若确定合同落实，且各项条件按期成立':'按确定合同落实后','projected')}</div>${view.contracts.length?`<ol class="handoff-contracts">${view.contracts.slice().sort((a,b)=>a.dueYear-b.dueYear).map(c=>`<li>第${c.dueYear}年 · ${esc(namesByActor[c.actorId])} · ${esc(c.cellId)}：${esc(c.title)}${c.conditional?(c.actionId==='authorize_training'?'（须当年核对提交时指定的原培训点仍有效运转且未获授权）':c.actionId==='open_port_warning'?'（须当年核对原分站仍运转且尚未开放）':c.actionId==='establish_future_check'?'（须当年核对真实测量/教学人手；不是旧失败补做）':c.actionId==='upgrade_archive_check'?'（须当年核对原保档仍运转及真实测量/教学人手）':'（须当年核对原记录与实际人手）'):''}</li>`).join('')}</ol>`:'<p>本轮全部明确放弃，没有新增合同。</p>'}${view.serviceConditional.length?'<p class="port-access-outlook">远港公开预警只改变该分站未来的准入；第31年条件不符则取消，费用不退。本表不会因此添加人手、授权、异源校验、河港信任或交班方针。</p>':''}${view.authorizationConditional?.length?`<div class="handoff-conditional authorization-outlook"><h3>地方授权的另一条分支</h3>${view.authorizationConditional.map(c=>`<p>${esc(c.cellId)}：第${c.dueYear}年仍须提交时指定的原培训点有效运转、来源可核实且尚未获授权。目标失效、被替换或已获授权则取消，费用不退。${c.workload?'若授权兑现，原点提高政治、经济来源，降低科学来源；保留基本读尺与覆盖，实际来源仍乘维护系数。取消则不重排原点。':'协商不增加人手、产出、预警覆盖、异源校验或河港信任。'}</p>`).join('')}${capability(view.withoutAuthorization,'若原学徒授权未兑现，其他合同仍按条件落实','without-authorization')}</div>`:''}${view.conditional.length?`<div class="handoff-conditional"><h3>后续校验的另一条分支</h3>${view.conditional.map(c=>`<p>${esc(c.cellId)}：${c.supported?`当前人手或已锁定的先行培训可提供支持，但第${c.dueYear}年仍需真实存在并运行。`:`当前没有真实测量或教学人手，本轮也未锁定先行培训；若情况不变，第${c.dueYear}年将取消，费用不退。`}${c.actionId==='establish_future_check'?'这是从零建立的未来校验，不把过去写成一次未完成的复核。':c.actionId==='upgrade_archive_check'?'这是把已有地方保档接成未来指令校验；原档还须保持运转。B4原本就是交班校验支点，这项升级不增加第二个地域，也不重算第23年。':''}</p>`).join('')}${capability(view.withoutConditionalChecks||view.withoutRecovery,'若后续校验未完成，其他确定合同仍落实','without-recovery')}</div>`:''}${view.authorizationConditional?.length&&view.conditional.length?`<div class="handoff-conditional"><h3>授权与后续校验都未完成时</h3>${capability(view.withoutConditional,'若两类条件均未成立，其他确定合同仍落实','without-conditional')}</div>`:''}<details><summary>对照的假设与旧档规则</summary>${view.notes.map(t=>`<p>${esc(t)}</p>`).join('')}</details></section>`;
}
function handoffStatus(view,c){
 if(!c)return '条件未知，不补作判断。';
 if(!view.policy)return '未锁定交班方针；具备能力不等于已经交班。';
 if(view.policy.actionId==='central_review')return `保留集中协调；${c.commandCheck?'本组条件下有指令校验':'本组条件下尚缺指令校验'}。`;
 const missing=view.policy.actionId==='share_power'?c.shareMissing:c.missing;
 return missing.length?`仍缺：${missing.join('；')}。`:`${view.policy.actionId==='share_power'?'共享':'退出'}所需承接${view.policy.actionId==='share_power'?'与信任':''}条件齐备。`;
}
function windowOutlook(){
 const handoff=getHandoffOutlook(state),risk=getCrisisOutlook(state);
 if(handoff){
  if(!handoff.ready)return handoffOutlookPanel();
  const rows=[['当前能力',handoff.current],['若合同按期落实、条件成立',handoff.projected]];
  if(handoff.authorizationConditional?.length)rows.push(['若原学徒授权未兑现',handoff.withoutAuthorization]);
  if(handoff.conditional.length)rows.push(['若后续校验未完成',handoff.withoutConditionalChecks||handoff.withoutRecovery]);
  if(handoff.authorizationConditional?.length&&handoff.conditional.length)rows.push(['若授权与后续校验均未完成',handoff.withoutConditional]);
  return `<section class="notice window-risk-summary" data-window-risk-summary="handoff"><h2>交班条件：现在与可能的后来</h2><p>以下是条件对照，尚未提交或兑现。最终仍按第40年真实存续状态核对，不保证结局。</p><dl class="outlook-branches">${rows.map(([title,c])=>`<div><dt>${title}</dt><dd>${esc(handoffStatus(handoff,c))}</dd></div>`).join('')}</dl>${handoff.model!=='mandate'?`<p>沿用本局${handoff.model==='legacy'?'旧版累计':'旧版地域'}规则，不追加地方授权门槛。</p>`:''}<details class="decision-details" data-window-outlook-details="handoff"><summary>人手与条件明细</summary>${handoffOutlookPanel()}</details></section>`;
 }
 if(risk){
  if(!risk.ready)return crisisOutlookPanel();
  const number=n=>Number(n).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  return `<section class="notice window-risk-summary" data-window-risk-summary="crisis"><h2>第23年：成功与未完成都要承担</h2><p>已锁合同的条件推算，尚未提交或兑现。损失系数不是伤亡比例。</p>${risk.attempts.map(a=>`<p>${esc(state.actors.find(actor=>actor.id===a.actorId)?.name||a.actorId)} · ${esc(a.cellId)}复核：${Math.round(a.probability*100)}%，第${a.dueYear}年只判定一次。</p>`).join('')||'<p>本轮未锁定交叉复核。</p>'}<p>${risk.vetoBase<1?`停闸后备基数${risk.vetoBase.toFixed(2)}，只采用较强的一份。`:'未安排停闸后备，未纠正共同标准时基数仍为1。'}${risk.guaranteedReview?'本局复核确定完成，停闸不再额外减损。':''}</p>${risk.success.available?`<p><strong>${risk.guaranteedReview?'按合同确定完成':'任一复核及时完成'}：</strong>共同失效损失系数为0，洪水仍会到来。</p>`:''}${risk.fallback.possible?`<p><strong>${risk.attempts.length?'若复核均未及时完成':'若共同标准未纠正'}：</strong>${risk.legacy?'整体':'四地平均'}损失系数${number(risk.fallback.damage)}；${risk.vetoBase<1?'停闸后备仍生效':'按本组条件中的地方预警与互助结算'}。</p>`:''}<details class="decision-details" data-window-outlook-details="crisis"><summary>逐地风险与依据</summary>${crisisOutlookPanel()}</details></section>`;
 }
 return '';
}
function lockedContractDetails(act,d,actorId){
 const options={cellId:d.cellId,actorId,legacyEvidence:d.evidence};
 return `<details class="decision-details" data-task-contract-details><summary>完整合同与依据</summary>${buildingContractPanel(act,options)}${act.id==='open_port_warning'?`<p class="port-access-contract">${esc(act.modelNote)}</p>`:''}${act.id==='complete_review'?`<p class="recovery-contract">${esc(act.modelNote)}</p>`:''}${act.id==='mutual_aid'?`<p class="aid-contract">${esc(act.modelNote)}</p>`:''}${['share_power','withdraw'].includes(act.id)&&usesHandoffRules(state)?`<p class="handoff-readiness">${esc(act.modelNote)}</p>`:''}${act.modelNote&&!['open_port_warning','complete_review','mutual_aid','share_power','withdraw'].includes(act.id)?`<p>${esc(act.modelNote)}</p>`:''}<p>这些条件尚未兑现。${esc(getActionResponsibility(act.id))}</p></details>`;
}
function windowWarnings(review){
 if(!review.warnings.length)return '';
 // This warning repeats the visible task's cost, outcome and cancellation.
 // Keep only its additional constraints here, with the original wording intact.
 const repeated=review.warnings.filter(text=>text.startsWith('东岸承接协商第31年'));
 const primary=review.warnings.map(text=>text.startsWith('东岸承接协商第31年')?(usesTrainingWorkloadRules(state)?'原点年度来源仍乘实际维护；不新建学校，D5同源学徒不会连带取得E4授权。':'不新建学校；D5同源学徒不会连带取得E4授权。'):text);
 return `<section class="notice commit-warnings"><h2>这轮安排的取舍</h2><ul>${primary.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>${repeated.length?`<details class="decision-details" data-task-contract-details><summary>重读承接条件原文</summary>${repeated.map(text=>`<p>${esc(text)}</p>`).join('')}</details>`:''}</section>`;
}
function windowReview(){
 const aa=actors(),review=getWindowReview(state),ready=review.ready,copy=getDecisionStageCopy('window',state),stage=getStageBoundaryContext(state);
 if(state.phase!=='planning')return `<section class="page narrow decision-page" data-decision-stage="window"><span class="eyebrow">${esc(copy.eyebrow)}</span><h1>${esc(copy.status)}</h1><p>${esc(copy.summary)}</p><p>${esc(copy.caution)}</p>${button(state.phase==='ended'?'查看阶段结局':'继续年度演变',state.phase==='ended'?'ending':'playback','','primary')}${back()}</section>`;
 const taskCards=aa.map(a=>{
  const d=state.drafts[a.id],act=renewalDisplay(state,review.tasks.find(task=>task.d.actorId===a.id)?.a,d?.cellId),options={cellId:d?.cellId,actorId:a.id,legacyEvidence:d?.evidence};
  return `<article class="task-card" data-task-actor="${a.id}"><div class="section-heading"><h2 data-review-target="actor:${esc(a.id)}" tabindex="-1">${esc(a.name)}</h2>${tag(!d?'未安排':d.status==='passed'?'明确放弃':'已锁定',d?'gold':'')}</div>${d?`<p class="task-choice">${esc(act?.title||d.title||d.actionId||'本窗口不介入')}${d.cellId?` · ${d.cellId}`:''}</p>${act?`<p class="muted">${esc(costText(act.cost))}<br>${esc(chanceText(act))}</p>`:''}<div class="button-row draft-edit-actions">${getDraftEditContext(state,a.id)?button('修改安排','edit-draft',`data-actor="${a.id}"`,'secondary'):''}${button('撤下安排','unlock',`data-actor="${a.id}"`,'text-button')}</div>${act?`<p class="locked-outcome"><strong>${esc(getLockedOutcomeLabel())}：</strong>${esc(actionClaim(act,'reward',options))}</p><p class="task-risk" data-contract-material-risk><strong>仍需承担：</strong>${esc(actionClaim(act,'risk',options))}</p>${buildingResponsibility(act,options)}${act.staffingNote?`<p class="notice staffing-contract">${esc(act.staffingNote)}</p>`:''}${act.id==='relocate_teacher'?`<section class="notice relocation-contract"><h2>${esc(getRelocationContract(state)?.title)}</h2><p>${esc(getRelocationContract(state)?.summary)}</p></section>`:''}${lockedContractDetails(act,d,a.id)}`:''}`:`<p>还需要为这位棋子锁定一个任务，或明确放弃。</p><div class="button-row">${button('安排任务','assign',`data-actor="${a.id}"`)}${button('放弃本窗口','pass',`data-actor="${a.id}"`)}</div>`}</article>`;
 }).join('');
 const costs=Object.keys(review.costs).length?`<section class="commit-costs" id="window-costs" tabindex="-1"><h2>本轮成本与余额</h2><p class="muted">按地域支付，不是可在全图通用的钱。下列余额只扣本次确定成本，尚未包含自然演化。</p>${Object.entries(review.costs).map(([id,cost])=>`<article><h3 data-review-target="cost:${esc(id)}" tabindex="-1">${esc(id)} · ${esc(state.cells.find(c=>c.id===id).name)}</h3>${Object.entries(cost).map(([k,v])=>{const before=state.cells.find(c=>c.id===id).channels[k];return `<p class="cost-line ${before<v?'insufficient':''}"><span>${names[k]}</span><strong>${before.toFixed(1)} − ${v} → ${(before-v).toFixed(1)}</strong></p>`;}).join('')}</article>`).join('')}</section>`:'<p class="commit-costs" id="window-costs">本轮没有确定的介入成本。</p>';
 return `<section class="page narrow decision-page" data-decision-stage="window"><span class="eyebrow">${esc(copy.eyebrow)}</span><h1>${esc(copy.title)}</h1><p class="decision-status">${esc(copy.status)}</p><p>${esc(copy.summary)}</p><nav class="review-jumps" aria-label="本轮安排页内导航"><a href="#window-tasks">安排</a><a href="#window-costs">成本</a><a href="#window-risks">风险</a></nav>${renderWindowReadiness(getWindowReadinessContext(state,review))}<div id="window-tasks" tabindex="-1">${taskCards}</div>${costs}<div id="window-risks" tabindex="-1">${renderPlanningOpportunity(getPlanningOpportunity(state))}${windowWarnings(review)}${windowOutlook()}</div><div class="notice decision-caution"><strong>${ready?'整轮条件已通过，可以提交。':'尚未满足提交条件。'}</strong><p data-stage-commit-caution>${esc(stage?.nextDestination?.commitCaution||copy.caution)}</p></div><div class="review-actions" data-review-actions>${button(copy.primaryLabel,'commit',!ready?'disabled':'','primary')}<a class="review-return" href="#window-tasks">返回角色安排，修改草稿</a>${button('暂不提交，返回世界','home','','secondary')}</div></section>`;
}
// A journal only names records already present in history. Link validation also
// rejects cross-table ID collisions, without reading pending event prose.
function journalSourceKnown(id){
 const all=[...state.history,...state.events],root=state.history.filter(e=>e.id===id);
 if(root.length!==1)return false;
 const seen=new Set();let next=id;
 while(next){const matches=all.filter(e=>e.id===next);if(!matches.length)return true;
  if(matches.length!==1||seen.has(next))return false;
  const e=matches[0];if(!Number.isInteger(e.year)||e.year>state.year||(e.reality!==undefined&&e.reality!=='R1')||e.status==='pending')return false;
  seen.add(next);next=e.parentId;
 }
 return true;
}
function journalLinks(turn){return `<div class="playback-latest-actions button-row">${journalSourceKnown(turn.id)?button('核对这条记载','trace',`data-id="${esc(turn.id)}"`,'text-button'):'<p class="tiny">来源链缺失或不一致，暂不跳转。</p>'}${turn.cellId&&state.cells.some(c=>c.id===turn.cellId)?button(`查看 ${esc(turn.cellId)}`,'locate',`data-cell="${esc(turn.cellId)}"`,'text-button'):''}${visitButton(turn.cellId)}</div>`;}
function journalEntry(turn,{latest=false}={}){const record=turn.record,fd=feeRecordDisplay(state,record),review=getReviewHistory(state,turn.id);return `<article class="${latest?'playback-latest':'journal-turn'}" data-journal-record="${esc(turn.id)}" data-journal-kind="${esc(turn.category)}"${latest?' data-playback-latest':''}><p class="playback-latest-meta">第 ${turn.year} 年 · ${esc(turn.label)}${turn.cellId?` · ${esc(turn.cellId)}`:''}</p><${latest?'h2':'h3'} class="playback-latest-title" tabindex="-1">${esc(fd?.title||turn.title)}</${latest?'h2':'h3'}>${review?`<p class="tiny review-original-label">${esc(review.originalLabel)}</p>`:''}<p class="journal-record-text">${esc(fd?.text||record.text||record.description||record.reason||'这条记载没有保存正文；不补写具体结果。')}</p>${feeOriginal(fd)}${turn.id==='succession-window'?successionContextPanel():''}${reviewHistoryPanel(turn.id,true)}${feeHistoryPanel(turn.id)}${relocationHistoryPanel(turn.id)}${staffingHistoryPanel(record)}<details class="journal-meaning"><summary>这条记载意味着什么</summary><p class="playback-latest-summary">${esc(turn.summary)}</p></details>${journalLinks(turn)}</article>`;}
function playback(){
 const journal=getPlaybackJournal(state),copy=getDecisionStageCopy('playback',state),stage=getStageBoundaryContext(state);
 if(!journal||journal.isBoundary)return `<section class="page narrow"><h1>这段年度演变已经结束。</h1>${button('阅读十年回顾','review','','primary')}${back()}</section>`;
 const latest=journal.latestTurn,current=journal.currentRecords,otherCurrent=journal.turns.filter(t=>t.year===state.year&&t.id!==latest?.id);
 return `<section class="page narrow playback-page" data-playback-journal><div class="playback-heading"><h1>年度记载</h1></div><div class="history-list playback-feature">${latest?journalEntry(latest,{latest:true}):'<p class="playback-empty">本次提交后还没有可核实的新转折。是否兑现以随后留下的记录为准，年度结算仍在继续。</p>'}${otherCurrent.map(t=>journalEntry(t)).join('')}</div>${journal.notes?.length?`<p class="notice journal-notes">${journal.notes.map(esc).join(' ')}</p>`:''}${latest&&latest.year<state.year?`<p class="playback-retained">保留第 ${latest.year} 年已发生的记载，不是今年又发生一次。</p>`:''}<p class="playback-state" role="status">${esc(playbackNotice|| (timer?'正在逐年推进，遇新记载会停下。':'当前暂停，阅读不会推进年份。'))}</p><div class="playback-controls">${button('推进到下一条记载 →','next-record','','primary')}${button('逐年推进','step')}${button(timer?'暂停':'自动播放，遇记载停下',timer?'pause':'auto')}</div><p class="playback-contract-note">${esc(copy.status)} ${esc(copy.summary)} 逐年结算到下一条记载或${esc(stage?.nextDestination?.label||`第 ${journal.nextWindow} 年窗口`)}，不预读结果，不改变概率。</p><details data-playback-current><summary>核对第 ${state.year} 年原始记录 · ${current.length}条</summary><div class="playback-records history-list">${current.map(e=>eventCard(e,false,true)).join('')||'<p class="empty">这一年没有新的制度记录。维护与四通道传播仍按原规则结算。</p>'}</div></details><details data-playback-past><summary>重读本段已发生转折 · ${journal.turns.length}条</summary><p class="tiny">第 ${journal.start} 年提交之后至今，只列已发生记录，不补写未兑现结果。</p>${journal.turns.map(t=>journalEntry(t)).join('')||'<p>还没有新的转折记载。</p>'}</details><div class="playback-skip">${button(stage?.nextDestination?.skipLabel||`略过逐条阅读，到第 ${journal.nextWindow} 年窗口`,'skip','','secondary')}<p class="tiny">仍完成每一年结算；已发生转折会留在十年回顾，不会重掷。</p></div>${button('暂停并查看世界','pause-world','','secondary')}</section>`;
}
function reviewTurns(){const j=getPlaybackJournal(state);if(!j?.isBoundary)return '';return `<section class="review-turns" data-review-turns><details class="review-turns-records" data-review-turns-disclosure><summary><span>按年核对这段转折 · ${j.turns.length}条</span><small>展开完整记载、来源与现场</small></summary><div class="review-turns-body"><h2>这十年发生的转折</h2><p>${state.phase==='ended'?'核对这一阶段已发生的变化与留下的责任。':'先看已发生的变化，再决定下一次介入。'}来源与现场可随时返回这里。</p>${j.notes?.length?`<p class="notice journal-notes">${j.notes.map(esc).join(' ')}</p>`:''}${j.turns.map(t=>journalEntry(t)).join('')||'<p>没有新的转折记载；原年度结算仍已完成。</p>'}</div></details></section>`;}

function review(){const stage=getStageBoundaryContext(state)?.review,recap=getDecadeReview(state),journal=getPlaybackJournal(state),start=Math.max(0,state.year-10),entries=state.history.filter(e=>e.year>start&&e.year<=state.year);return `<section class="page reading review-page" data-review-stage="${esc(state.phase)}">${stage?`<nav class="review-stage-nav" data-review-stage-nav aria-label="回顾之后的去向">${button(stage.label,stage.action,'','primary')}</nav>`:back()}<header class="review-stage-heading"><span class="eyebrow">第 ${start}—${state.year} 年</span><h1>${esc(stage?.title||'十年回顾')}</h1><p class="lead">${esc(stage?.summary||'已发生的当前现实')}</p></header>${renderDecadeRecollection(recap)}${renderDecadeSettlement(journal)}${reviewTurns()}<div class="review-summary"><span>${entries.length}<small>历史记录</small></span><span>${state.institutions.filter(i=>i.active!==false).length}<small>持续制度</small></span><span>${actors().length}<small>${esc(stage?.actorCountLabel||'可用棋子')}</small></span></div><details class="decade-records"><summary>展开逐年原始记录 · ${entries.length}条</summary><div class="history-list">${entries.length?entries.slice().reverse().map(e=>eventCard(e,false,true)).join(''):'<p class="empty">没有新的情节事件。自然演化与已有制度仍持续产生影响。</p>'}</div></details></section>`;}

function archive(){const stage=getStageBoundaryContext(state),cell=getCell(),localRecord=getLocalCrisisRecord(state,cell.id),destination=getRelocationDestination(state,cell.id),destinationIds=new Set(destination?.sources.map(source=>source.recordId)||[]),records=state.history.filter(e=>!ui.cellHistory||e.cellId===ui.selected||(localRecord?.recordId&&e.id===localRecord.recordId)||destinationIds.has(e.id));return `<section class="page reading">${back()}<span class="eyebrow">ARCHIVES & REALITIES</span><h1>曾经发生，与正在发生。</h1>${visitButton(cell.id)}<div class="archive-grid"><article class="reality old"><span class="stamp">R0 · 已归档现实</span><h2>那扇开着的教室窗</h2><p>来源：主角亲历的旧现实档案，续史局封存副本。旧河港缺少共同预警，苏岚后来在免费学校任教。</p><p>这份档案证明那段人生曾经发生，不证明当前人生更差，也不代表未选择的游戏分支。</p></article><article class="reality current"><span class="stamp">R1 · 当前现实</span><h2>${esc(cell.id)} · 第 ${state.year} 年</h2>${channels(cell)}<p>实际棋盘、制度、人物与事件只由这份现实决定。</p></article><article class="reality forecast"${stage?.terminal?' data-stage-archive':''}><span class="stamp">${esc(stage?.archive.stamp||'P1 · 记录待核')}</span><h2>${esc(stage?.archive.title||'阶段信息待核')}</h2><p>${esc(stage?.archive.body||'当前年份与阶段不能核实，不推断未来。')}</p></article></div>${channelHistoryPanel(cell.id)}<div class="section-heading"><h2>${ui.cellHistory?`${ui.selected} 地域记录`:'已提交历史'}</h2>${button(ui.cellHistory?'查看全部':'仅看所选地域','toggle-history','','text-button')}</div><div class="history-list">${ui.cellHistory?localCrisisPanel(localRecord,true)+relocationDestinationPanel(cell.id):''}${records.slice().reverse().map(e=>eventCard(e)).join('')||'<p class="empty">尚无记录。查看档案不会消耗名额。</p>'}</div></section>`;}
function trace(){
 const explanation=getCrisisHistory(state,ui.traceId);
 if(explanation)return `<section class="page narrow crisis-history">${sceneSourceReturnPanel()}${readingReturnButton()}${endingReturnButton()}${button('← 返回档案','archive','','back')}<span class="eyebrow">RECORDS · MECHANISM · RESPONSE</span><h1>${esc(explanation.title)}</h1><p class="lead">${esc(explanation.explanation)}</p><section class="crisis-discovery"><h2>记录与发现渠道</h2><p>以下是预警材料可追查的来路，不是致灾链；建站不是这场危机的触发条件。</p><div class="causal-chain">${explanation.discovery.map(e=>eventCard(e,false,false,getRecordStageContext(state,e))).join('<div class="causal-arrow" aria-label="记录来源">↓ 记录流转</div>')}</div></section><section class="crisis-responses"><h2>干预与回应</h2>${explanation.responses.length?explanation.responses.map(r=>`<article class="notice" data-response-event="${esc(r.eventId)}"><h3>${esc(r.label)}</h3><p>${esc(r.note)}</p>${button('查看这项回应的实际来源','trace',`data-id="${esc(r.recordId||r.eventId)}"`,'text-button')}</article>`).join(''):'<p>没有可核实的危机回应合同，不从今天的机构补造当年的保护。</p>'}</section><section class="crisis-recorded-impact"><h2>${explanation.impact?'第23年的记录':state.year>=23?'第23年的记录缺失或不完整':'尚未结算'}</h2>${explanation.detail.map(t=>`<p>${esc(t)}</p>`).join('')}${explanation.impact?eventCard(explanation.impact,false,false,getRecordStageContext(state,explanation.impact)):''}</section>${button('在世界地图上查看记录路径','trace-map','','primary')}</section>`;
 const chain=traceEvent(state,ui.traceId)||[];return `<section class="page narrow">${sceneSourceReturnPanel()}${readingReturnButton()}${endingReturnButton()}${button('← 返回档案','archive','','back')}<span class="eyebrow">CAUSE & CONSEQUENCE</span><h1>这件事，由什么引起？</h1><p class="muted">这是一条可查证的来源链，不是精确功劳百分比。手工编排的制度事件与逐年模拟传播分别标注。</p><div class="causal-chain">${chain.map(e=>eventCard(e,false,false,getRecordStageContext(state,e))).join('<div class="causal-arrow">↓</div>')||'<p>没有更早的因果父项。这是一个直接行动或独立世界事件。</p>'}</div>${button('在世界地图上查看这条链','trace-map','','primary')}</section>`;
}
function endingSources(ids,key){
 const found=[...new Set(ids||[])].map(id=>{const matches=[...state.history,...state.events].filter(e=>e.id===id);return matches.length===1&&Number.isInteger(matches[0].year)&&matches[0].year<=state.year&&(matches[0].reality===undefined||matches[0].reality==='R1')?matches[0]:null;}).filter(Boolean);
 return found.length?`<details class="ending-sources" data-ending-disclosure="sources-${esc(key)}"><summary>查看这段记录的来源 · ${found.length}</summary><div class="ending-source-list">${found.map((e,index)=>button(`第 ${e.year} 年 · ${esc(e.title||'已存记录')}`,'trace',`data-id="${esc(e.id)}" data-ending-return-key="${esc(key)}-${index}"`,'text-button')).join('')}</div></details>`:'';
}
// A source detour remembers only the current reading session. It is never saved,
// never replaces a paid investigation and never takes over a journal/ending return.
function sceneSourceOrigin(){
 const origin=sceneSourceReturn;
 return origin&&origin.state===state&&origin.year===state.year&&origin.phase===state.phase&&actors().some(a=>a.id===origin.actor)?origin:null;
}
function sceneSourceReturnPanel(){
 const origin=sceneSourceOrigin();if(!origin)return '';
 const context=getSceneSourceReading(state,{screen:origin.screen,cellId:origin.selected,actorId:origin.actor,sourceId:origin.sourceId});
 const name=actors().find(a=>a.id===origin.actor)?.name||'介入员',place=origin.screen==='avg'?'现场':'只读回访';
 return `<aside class="scene-source-reading" data-scene-source-reading data-source-origin-cell="${esc(origin.selected)}" data-source-origin-actor="${esc(origin.actor)}" data-source-record-id="${esc(origin.sourceId)}"><div class="scene-source-return-action">${button(`← 返回 ${esc(origin.selected)} ${origin.screen==='avg'?'现场':'回访'}原处`,'scene-source-return','','secondary')}</div><p class="scene-source-origin">${esc(name)} · ${esc(origin.selected)} · 第 ${origin.year} 年${place}</p>${context?`<p class="scene-source-record" data-scene-source-record>从现场打开的来源 · 第 ${context.sourceYear} 年 · ${esc(context.sourceTitle)}</p>`:''}<small>阅读来源不取证、不扣费、不改变安排。返回后仍由你选择下一步。</small></aside>`;
}
function rememberSceneSource(el){
 if(sceneSourceOrigin()||!['avg','visit'].includes(ui.screen))return false;
 if(ui.screen==='visit'&&(readingReturn?.state===state||endingReturn?.state===state&&state.phase==='ended'))return false;
 sceneSourceReturn={state,year:state.year,phase:state.phase,screen:ui.screen,selected:ui.selected,actor:selectedActor().id,choice:ui.choice,sourceId:el.dataset.id,
  scroll:window.scrollY,opened:[...ROOT.querySelectorAll('main details')].flatMap((d,i)=>d.open?[i]:[]),
  selector:['action','id','cell'].filter(k=>el.dataset[k]!==undefined).map(k=>`[data-${k}="${CSS.escape(el.dataset[k])}"]`).join(''),
  index:[...ROOT.querySelectorAll('[data-action]')].indexOf(el),evidenceBookmark,sceneReturn};
 return true;
}
function restoreSceneSource(){
 const origin=sceneSourceOrigin();if(!origin){sceneSourceReturn=null;go('world');return null;}
 ui.selected=origin.selected;ui.actor=origin.actor;ui.choice=origin.choice;
 // Restore the valid material purpose before the one render. No investigation
 // inventory is rebuilt, refunded or copied from a different place.
 evidenceBookmark=origin.evidenceBookmark;sceneReturn=origin.sceneReturn;sceneSourceReturn=null;go(origin.screen);
 for(const [i,d] of [...ROOT.querySelectorAll('main details')].entries())d.open=origin.opened.includes(i);
 const indexed=ROOT.querySelectorAll('[data-action]')[origin.index];
 const target=indexed?.matches(origin.selector)?indexed:ROOT.querySelector(origin.selector);
 target?.focus({preventScroll:true});window.scrollTo({top:origin.scroll,behavior:'instant'});
 return target?focusTarget():null;
}
function readingReturnButton(){return readingReturn?.state===state&&readingReturn.year===state.year?button(`← 返回${readingReturn.screen==='review'?'十年回顾':'年度记载'}原处`,'reading-return','','back reading-return'):'';}
function rememberReading(el){
 if(!['playback','review'].includes(ui.screen))return;
 readingReturn={state,year:state.year,screen:ui.screen,selected:ui.selected,scroll:window.scrollY,
  opened:[...ROOT.querySelectorAll('main details')].flatMap((d,i)=>d.open?[i]:[]),
  selector:['action','id','cell'].filter(k=>el.dataset[k]!==undefined).map(k=>`[data-${k}="${CSS.escape(el.dataset[k])}"]`).join(''),
  index:[...ROOT.querySelectorAll('[data-action]')].indexOf(el)};
}
function restoreReading(){
 const previous=readingReturn?.state===state&&readingReturn.year===state.year?readingReturn:null;
 if(!previous){go(state.phase==='playback'?'playback':getPlaybackJournal(state)?.isBoundary?'review':'world');return;}
 ui.selected=previous.selected;go(previous.screen);
 for(const i of previous.opened){const d=ROOT.querySelectorAll('main details')[i];if(d)d.open=true;}
 const indexed=ROOT.querySelectorAll('[data-action]')[previous.index];
 const target=indexed?.matches(previous.selector)?indexed:ROOT.querySelector(previous.selector);
 target?.focus({preventScroll:true});window.scrollTo({top:previous.scroll,behavior:'instant'});readingReturn=null;
}
function endingReturnButton(){return endingReturn?.state===state&&state.phase==='ended'?button('← 返回结局原处','ending-return','','back ending-return'):'';}
function rememberEnding(el){if(ui.screen!=='ending')return;endingReturn={state,scroll:window.scrollY,opened:[...ROOT.querySelectorAll('[data-ending-disclosure][open]')].map(d=>d.dataset.endingDisclosure),openDetails:[...ROOT.querySelectorAll('.ending details')].flatMap((d,index)=>d.open?[index]:[]),action:el.dataset.action,id:el.dataset.id,cell:el.dataset.cell,key:el.dataset.endingReturnKey,index:[...ROOT.querySelectorAll('[data-action]')].indexOf(el)};}
function restoreEnding(){
 const previous=endingReturn?.state===state?endingReturn:null;go('ending');if(!previous)return;
 for(const key of previous.opened){const d=ROOT.querySelector(`[data-ending-disclosure="${CSS.escape(key)}"]`);if(d)d.open=true;}
 for(const index of previous.openDetails||[]){const d=ROOT.querySelectorAll('.ending details')[index];if(d)d.open=true;}
 const matches=[...ROOT.querySelectorAll(`[data-action="${CSS.escape(previous.action)}"]`)];
 const indexed=ROOT.querySelectorAll('[data-action]')[previous.index];
 const target=previous.key?ROOT.querySelector(`[data-ending-return-key="${CSS.escape(previous.key)}"]`):indexed?.dataset.action===previous.action&&indexed?.dataset.id===previous.id&&indexed?.dataset.cell===previous.cell?indexed:matches.find(e=>e.dataset.id===previous.id&&e.dataset.cell===previous.cell);target?.focus({preventScroll:true});window.scrollTo({top:previous.scroll,behavior:'instant'});
}
function ending(){
 const art=getEndingArt(state)||sceneArt(state,'D4',{ending:true}),e=getEnding(state),recollection=getEndingRecollection(state),people=recollection?.people||characterEpilogue(state),originalPeople=characterEpilogue(state),policyContext=getEndingPolicyContext(state,recollection);
 const labels={institutions:'运转制度',networks:'维护网络',autonomy:usesHandoffRules(state)?'承接与校验地域数':'独立能力',delegatedStaff:'已授权承接地域',independentChecks:'异源校验地域',handoffStatus:'交班准备',trust:'地方信任',crisis:'危机结果',warningCoverage:'四地平均覆盖系数',crisisDamage:'第23年平均损失系数',anchoredSurvivors:'仍存活的锚定者',years:'当前年份'};
 return `<section class="page reading ending"><span class="eyebrow ending-chapter">第 40 年 · 留给后来的人</span><h1>${esc(e.title||'一段仍在继续的历史')}</h1><p class="ending-opening" data-ending-opening>${esc(recollection?.opening||e.text||e.summary)}</p><figure class="ending-art" data-ending-art="${esc(art.motif||'recorded')}"><img src="${import.meta.env.BASE_URL}assets/${esc(art.file)}" alt="${esc(art.alt)}" width="1000" height="420"><figcaption>${esc(art.caption)}</figcaption></figure>${endingSources(art.sourceIds,'art')}
 ${recollection?.lastInterventions?.length?`<section class="ending-interventions" data-ending-interventions data-last-interventions><h2>最后一次介入，后来怎样了</h2>${recollection.lastInterventions.map(card=>`<article data-ending-actor="${esc(card.actorId)}" data-ending-outcome="${esc(card.status||'unknown')}"><span class="eyebrow">${esc(card.name)} · 第30年</span><h3>${esc(card.choice)}</h3><p>${esc(card.outcome)}</p>${policyContext?.actorId===card.actorId?`<aside class="ending-policy-checkpoint" data-ending-policy-checkpoint><h4>${esc(policyContext.label)}</h4><p>${esc(policyContext.summary)}</p></aside>`:""}<p class="ending-responsibility">${policyContext?.actorId===card.actorId?`<strong>${esc(policyContext.responsibilityLabel)}：</strong>`:""}${esc(card.responsibility)}</p>${endingSources(card.sourceIds,`last-${card.actorId}`)}</article>`).join('')}</section>`:''}
 ${people.length?`<section class="character-epilogue" data-ending-people><h2>名字留在最后一页</h2>${people.map((p,index)=>`<article class="ending-person" data-ending-person="${esc(p.name)}"><span class="eyebrow">${esc(p.name)}</span><h3>${esc(p.title)}</h3>${p.paragraphs[0]?`<p>${esc(p.paragraphs[0])}</p>`:''}${p.paragraphs.length>1?`<details class="ending-person-history" data-ending-disclosure="person-${index}"><summary>继续读${esc(p.name)}的这四十年</summary>${p.paragraphs.slice(1).map(text=>`<p>${esc(text)}</p>`).join('')}</details>`:''}${endingSources(p.sources,`person-${index}`)}</article>`).join('')}</section>`:''}
 ${recollection?.historicalNote?`<p class="ending-history-note" data-ending-historical-note>${esc(recollection.historicalNote)}</p>`:''}
 <details class="ending-ledger" data-ending-ledger data-ending-disclosure="ledger"><summary>核对这份结局<span>原文、制度条件与历史清点</span></summary><div class="ending-ledger-body"><h2>原结局评语</h2>${recollection?.recordNote?`<p class="ending-record-note" data-ending-record-note>${esc(recollection.recordNote)}</p>`:''}<p>${esc(e.text||e.summary)}</p>${e.paragraphs?.map(p=>`<p>${esc(p)}</p>`).join('')||''}${reviewHistoryPanel()}<div class="ending-metrics">${Object.entries(e.metrics||{}).map(([k,v])=>`<p><span>${esc(labels[k]||k)}</span><strong>${esc(typeof v==='boolean'?(v?'有':'无'):k==='crisis'?({warning:'已预警',averted:'已避免共同失效',contained:'已控制',disaster:'地方灾难'}[v]||v):typeof v==='object'?JSON.stringify(v):v)}</strong></p>`).join('')}</div><details class="ending-original-people" data-ending-disclosure="original-people"><summary>查阅原人物记录全文</summary>${originalPeople.map(p=>`<section><h3>${esc(p.name)} · ${esc(p.title)}</h3>${p.paragraphs.map(text=>`<p>${esc(text)}</p>`).join('')}</section>`).join('')}</details><p class="muted">这不是人类灭绝。续史局与局外人员仍然存活。这个阶段评价的是地域、制度与人的遗产。</p></div></details>
 <div class="button-row">${button('重读这四十年','archive','','primary')}${button('导出这段历史','export')}${visitButton('B4')}${visitButton('D4')}${visitButton('E4')}${visitButton('D5')}${visitButton('F6')}</div><p class="muted">重新开始请到设置。旧存档可先导出保留。</p></section>`;
}
function settings(){return `<section class="page narrow">${back()}<span class="eyebrow">PREFERENCES & PRESERVATION</span><h1>把这一版历史留下。</h1><div class="settings-actions">${button(ui.bigText?'恢复标准字号':'启用 200% 字号','text-size')}${button('导出存档 JSON','export')}<label class="file-button">导入存档<input id="import-save" type="file" accept="application/json,.json"></label></div><p data-import-status role="status" aria-live="polite"${importReading?'':' hidden'}>${importReading?esc(importReadingText):''}</p><p>存档版本：${esc(state.version)}<br>行动规则：${usesTradeoffs(state)?'准备与取证取舍 v1':'原版场景规则（保留既有合同）'}<br>交班规则：${usesHandoffRules(state)?'人手、校验与地方授权 v1':'保留本局原结局规则'}<br>角色与互助：${usesAftermathRules(state)?'角色立场与时点合同 v1':'保留本局原角色合同'}<br>招募合同：${usesRecruitmentRules(state)?'按真实在岗职责 v1':'保留本局原招募合同'}<br>当前种子：${esc(state.seed)} · 第 ${state.year} 年<br>每次选择、锁定、提交与年度结算后自动保存在此浏览器。</p>${staffingPolicyPanel()}${branchPolicyPanel()}<p class="muted" data-training-workload-rules="${usesTrainingWorkloadRules(state)?'training-workload-v1':'preserved'}">学徒轮值：${usesTrainingWorkloadRules(state)?'原学徒承接时按明确合同改排职责':'保留本局原合同，不自动改排来源'}。</p><hr><h2>开始另一段历史</h2><label>新世界种子<input id="seed" type="number" value="12" min="0" max="999999"></label>${button('重新开始（先确认）','new-confirm','','secondary')}<div id="reset-confirm"></div><hr><p class="muted">远港准入：${usesPortAccessRules(state)?'新版可在第30年协商现存收费分站的公开预警':'本局保留原合同，不补发远港开放行动'}。</p><p class="muted">后续校验：${usesRecoveryRules(state)?'新版可在第30年接续真实失败记录':'本局沿用旧版，不补发后续校验合同'}。</p><p class="muted">从零未来校验：${usesFutureCheckRules(state)?'本局可在第30年B4筹备新校验席，第34年核对实际人手；仅面向未来，不补写旧失败或第23年结果':'本局保留原行动范围，不补发从零未来校验合同'}。</p><p class="muted">保档接续校验：${usesArchiveUpgradeRules(state)?'本局可在第30年把来源完整的B4保档接成指令校验席，第33年核对原档和实际人手；不赠人手、授权或方针，也不重算过去':'本局保留原行动范围，不补发保档升级合同'}。</p><p class="muted">制作状态：完整 0—40 年可玩原型。工程棋盘道具来自用户提供的原创交接素材；新的档案室场景为项目原创矢量图。资产仍在持续迭代，未进行真人或真机认证。高级回溯、全面战争和 64 格独立 AVG 未实现。</p><p class="muted">全部随机参数属于设计假设。没有联网账户、广告或分析追踪。</p></section>`;}
function focusTarget(){
 const element=document.activeElement;if(!element||!ROOT.contains(element))return null;
 let selector;
 if(element.id)selector=`#${CSS.escape(element.id)}`;
 else if(element.matches('.evidence > summary'))selector=`[data-evidence-id="${CSS.escape(element.parentElement.dataset.evidenceId)}"] > summary`;
 else if(element.dataset.reviewTarget)selector=`[data-review-target="${CSS.escape(element.dataset.reviewTarget)}"]`;
 else if(element.dataset.actorAgencyTarget)selector=`[data-actor-agency-target="${CSS.escape(element.dataset.actorAgencyTarget)}"]`;
 else if(element.dataset.action){selector=['action','id','cell','actor','layer','filter','section'].filter(key=>element.dataset[key]!==undefined).map(key=>`[data-${key}="${CSS.escape(element.dataset[key])}"]`).join('');}
 else if(element.matches('h1'))selector='main h1';
 if(!selector)return null;
 return {selector,index:[...ROOT.querySelectorAll(selector)].indexOf(element)};
}
function render({focusTo=null,preserveFocus=true,persist=true}={}){
 if(startupGuard.blocked){ui.screen='settings';document.documentElement.classList.toggle('large-text',ui.bigText);ROOT.innerHTML=recoveryPage();return;}
 if(draftEdit&&(draftEdit.state!==state||draftEdit.year!==state.year||draftEdit.actorId!==ui.actor||!getDraftEditContext(state,ui.actor)))draftEdit=null;
 cancelNewRun();
 const previousFocus=preserveFocus?focusTarget():null;
 const expanded=[...ROOT.querySelectorAll('.evidence[open]')].map(element=>element.dataset.evidenceId);
 const endingExpanded=[...ROOT.querySelectorAll('[data-ending-disclosure][open]')].map(element=>element.dataset.endingDisclosure);
 const playbackExpanded=['data-playback-current','data-playback-past'].filter(key=>ROOT.querySelector(`[${key}][open]`));
 const endingDetailIndexes=[...ROOT.querySelectorAll('.ending details')].flatMap((element,index)=>element.open?[index]:[]);
 const boardHost=ui.screen==='world'?ROOT.querySelector('#board'):null;
 if(board&&!boardHost){mapView=board.view();board.destroy();board=null;}
 document.documentElement.classList.toggle('large-text',ui.bigText);
 const pages={world,list,avg,visit,choice:()=>choice(),confirm:()=>choice(true),window:windowReview,playback,review,archive,trace,ending,settings};
 ROOT.innerHTML=`<div class="app-shell${ui.screen==='ending'?' ending-shell':''}${['avg','choice','confirm','window','playback','review'].includes(ui.screen)?' decision-shell':''}">${header()}<main id="main">${opportunityReturnPanel()}${draftEdit&&['world','list','avg','choice','confirm'].includes(ui.screen)?renderDraftEditContext(getDraftEditContext(state,ui.actor)):''}${(pages[ui.screen]||world)()}</main><footer class="footer"><span>余波 / 历史修订台</span><span>本地存档 · 原型 0.1</span></footer></div>${toast?`<div class="toast" role="status">${esc(toast)}</div>`:''}`;
 if(ui.screen==='world'){
  if(board&&boardHost)ROOT.querySelector('#board').replaceWith(boardHost);
  else board=makeBoard(ROOT.querySelector('#board'),id=>{if(storageBusy)return;evidenceBookmark=null;ui.selected=id;render();save();},mapView);
  board.update(state,ui.selected,ui.channel,ui.mapTrace||null);board.focus(ui.focus);
 }
 for(const id of expanded){const details=ROOT.querySelector(`[data-evidence-id="${CSS.escape(id)}"]`);if(details)details.open=true;}
 for(const key of playbackExpanded){const details=ROOT.querySelector(`[${key}]`);if(details)details.open=true;}
 for(const key of endingExpanded){const details=ROOT.querySelector(`[data-ending-disclosure="${CSS.escape(key)}"]`);if(details)details.open=true;}
 for(const index of endingDetailIndexes){const details=ROOT.querySelectorAll('.ending details')[index];if(details)details.open=true;}
 const target=focusTo?ROOT.querySelector(focusTo):previousFocus?ROOT.querySelectorAll(previousFocus.selector)[previousFocus.index]:null;
 if(target&&!target.disabled)target.focus({preventScroll:true});
 if(persist)save();
}
function go(screen){
 if(['window','settings','archive','playback','review','ending'].includes(screen))draftEdit=null;
 scenePointerJump=false;playbackPointerAdvance=false;sceneSourcePointerTarget=null;cancelNewRun();cancelImport();
 if(!['trace','visit'].includes(screen))sceneSourceReturn=null;
 if(screen!=='avg')evidenceBookmark=null;
 if(!['avg','choice','confirm'].includes(screen))sceneReturn=null;
 if(!['trace','visit'].includes(screen))readingReturn=null;
 if(!['trace','visit','ending'].includes(screen))endingReturn=null;
 if(screen!=='playback')stop();ui.screen=screen;render({preserveFocus:false});
 window.scrollTo({top:0,behavior:'instant'});
 const target=ui.screen==='avg'?ROOT.querySelector('[data-action="scene-section"][data-section="choices"]'):ui.screen==='review'?ROOT.querySelector('[data-review-stage-nav] button,main h1'):ROOT.querySelector('main h1,main [data-primary-action]');
 if(target){if(target.tagName==='H1')target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
}
// This navigation memory belongs only to the current open preview. It is not
// saved, never refunds research, and cannot cross an actor, place or world.
function rememberScenePreview(element){
 if(ui.screen!=='avg'||!element.matches('[data-planning-choices] [data-action="choose"]'))return;
 sceneReturn={state,year:state.year,actorId:selectedActor().id,cellId:ui.selected,actionId:element.dataset.id,scrollY:window.scrollY,
  expanded:[...ROOT.querySelectorAll('main details')].flatMap((item,index)=>item.open?[index]:[])};
}
function focusSceneSection(section){
 if(ui.screen!=='avg'||!['story','choices','materials'].includes(section))return;
 const target=ROOT.querySelector(`[data-scene-section="${section}"]`);
 if(target){target.focus({preventScroll:true});(section==='story'?ROOT.querySelector('[data-scene-voice-heading]')||target:target).scrollIntoView({block:'start',behavior:'instant'});}
}
function restoreScenePreview(){
 const origin=sceneReturn;
 const valid=origin&&origin.state===state&&origin.year===state.year&&state.phase==='planning'&&origin.actorId===selectedActor().id&&origin.cellId===ui.selected;
 sceneReturn=null;go('avg');
 if(!valid)return;
 const details=[...ROOT.querySelectorAll('main details')];
 for(const [index,item] of details.entries())item.open=origin.expanded.includes(index);
 const target=ROOT.querySelector(`[data-planning-choices] [data-action="choose"][data-id="${CSS.escape(origin.actionId)}"]`);
 if(!target)return;
 target.focus({preventScroll:true});window.scrollTo({top:origin.scrollY,behavior:'instant'});
 // A long card need not fit inside a phone. Keep its title visible rather than
 // restoring a scroll position that hides the focused card's beginning.
 const rect=target.getBoundingClientRect();
 if(rect.top<0||rect.top>window.innerHeight-48)target.scrollIntoView({block:'start',behavior:'instant'});
}
// Explicit resume is distinct from the original return-to-scene control.
// A reload discards ephemeral history; only the currently legal contract is
// used as a new reading destination. Earlier disclosures are never invented.
function resumeSceneContract(){
 const anchor=getSceneContractAnchor(state,bookmarkContext());
 if(!anchor){go('avg');return null;}
 const origin=sceneReturn,valid=origin&&origin.state===state&&origin.year===state.year&&origin.actorId===anchor.actorId&&origin.cellId===anchor.cellId&&origin.actionId===anchor.actionId;
 if(valid)restoreScenePreview();else{sceneReturn=null;go('avg');}
 const target=ROOT.querySelector(`[data-planning-choices] [data-action="choose"][data-id="${CSS.escape(anchor.actionId)}"]`);
 if(!target)return null;
 target.setAttribute('data-contract-resume','');target.focus({preventScroll:true});
 if(!valid)target.scrollIntoView({block:'start',behavior:'instant'});
 return target;
}
function stop(){clearInterval(timer);timer=null;}
function message(text){clearTimeout(toastTimer);toast=text;render();toastTimer=setTimeout(()=>{toastTimer=null;toast='';document.querySelector('.toast')?.remove();},3500);}
function advance({automatic=false}={}){
 const before=getPlaybackRecordIds(state);advanceYear(state);save();
 if(state.phase!=='playback'){stop();playbackNotice='';go('review');return;}
 const arrived=hasNewPlaybackRecord(before,state);
 if(automatic&&arrived){stop();playbackNotice=`已停在第 ${state.year} 年的新记载。再继续才会推进年份。`;}
 else playbackNotice='';
 render({focusTo:automatic&&arrived?'[data-playback-latest] h2':null});
 if(automatic&&arrived)ROOT.querySelector('[data-playback-latest]')?.scrollIntoView({block:'start',behavior:'instant'});
}
function advanceToRecord(){
 stop();const before=getPlaybackRecordIds(state);let steps=0;
 while(state.phase==='playback'&&steps++<40){advanceYear(state);if(hasNewPlaybackRecord(before,state))break;}
 save();playbackNotice=state.phase==='playback'?`已停在第 ${state.year} 年的新记载。` : '';
 go(state.phase==='playback'?'playback':'review');
}

// A directory scroll can move another card or plain text under a stationary
// multi-click. Preserve the original target before native focus/selection, and
// also guard click dispatch. New single clicks and keyboard Enter stay instant.
function blockScenePointerRepeat(event){
 if(sceneSourcePointerTarget&&event.detail>1){
  event.preventDefault();ROOT.querySelectorAll(sceneSourcePointerTarget.selector)[sceneSourcePointerTarget.index]?.focus({preventScroll:true});
  if(event.type==='click')window.getSelection()?.removeAllRanges();return true;
 }
 if(playbackPointerAdvance&&event.detail>1){
  event.preventDefault();
  const target=ROOT.querySelector('[data-review-stage-nav] button,main h1');
  target?.focus({preventScroll:true});
  if(event.type==='click')window.getSelection()?.removeAllRanges();
  return true;
 }
 if(evidenceReturnPointer&&event.detail>1){event.preventDefault();return true;}
 if(!scenePointerJump||event.detail<=1)return false;
 event.preventDefault();
 ROOT.querySelector(`[data-planning-choices] [data-action="choose"][data-id="${CSS.escape(scenePointerJump)}"]`)?.focus({preventScroll:true});
 if(event.type==='click')window.getSelection()?.removeAllRanges();
 return true;
}
ROOT.addEventListener('mousedown',blockScenePointerRepeat,true);
ROOT.addEventListener('click',async event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='cancel-save'){saveWriter.cancelPending();return;}if(storageBusy&&!['export','recovery-export'].includes(action)){event.preventDefault();return;}if(storageReadOnly()&&['evidence','lock','unlock','pass','commit','step','skip','auto','next-record','new-run','recovery-replace'].includes(action)){event.preventDefault();updateSaveIssue(storageReason(saveWriter.snapshot().lastError||(!saveWriter.snapshot().supported?'unsupported':'closed')));return;}if(blockScenePointerRepeat(event))return;scenePointerJump=false;evidenceReturnPointer=false;playbackPointerAdvance=false;sceneSourcePointerTarget=null;const agencyLink=event.target.closest('[data-actor-agency-link]');if(agencyLink){event.preventDefault();if(ui.screen==='avg'){const target=navigateActorAgency(agencyLink);if(target&&event.detail>0)sceneSourcePointerTarget=focusTarget();}return;}const readingLink=event.target.closest('[data-draft-comparison-link]');if(readingLink){event.preventDefault();if(draftEdit&&['choice','confirm'].includes(ui.screen)){const target=navigateDraftComparison(readingLink);if(target&&event.detail>0)sceneSourcePointerTarget=target.matches('summary')?{selector:'[data-draft-choice-comparison] > summary',index:0}:focusTarget();}return;}const el=event.target.closest('[data-action]');if(!el)return;event.preventDefault();if(el.disabled)return;const a=el.dataset.action;if(startupGuard.blocked){await recoveryClick(a);return;}try{switch(a){
 case 'home':ui.mapTrace=null;go('world');break;case 'archive':ui.cellHistory=false;go('archive');break;case 'settings':go('settings');break;case 'layer':ui.channel=el.dataset.layer;render();break;case 'focus':ui.focus=!ui.focus;render();break;case 'actor':{evidenceBookmark=null;if(!actors().some(actor=>actor.id===el.dataset.actor))throw Error('这位角色当前不能部署。');const top=window.scrollY;ui.actor=el.dataset.actor;render();window.scrollTo({top,behavior:'instant'});const target=ROOT.querySelector(`[data-action="actor"][data-actor="${CSS.escape(ui.actor)}"]`),rect=target?.getBoundingClientRect();if(rect&&(rect.top<0||rect.bottom>innerHeight))target.scrollIntoView({block:'nearest',behavior:'instant'});break;}case 'plan-as':{const plan=getWorldPlanning(state,ui.selected,selectedActor().id);if(ui.screen!=='world'||plan?.primary.kind!=='switch-scene'||plan.primary.actorId!==el.dataset.actor)throw Error('当前角色与合同已变化，请重新查看入口。');ui.actor=el.dataset.actor;sceneReturn=null;go('avg');break;}case 'list':go('list');break;case 'select':case 'locate':ui.selected=el.dataset.cell;mapView=null;go('world');board?.recenter();break;case 'filter':ui.filter=el.dataset.filter;render();break;case 'reset-filter':ui.query='';ui.filter='all';render();break;
 case 'teaching-jump':{if(['choice','confirm'].includes(ui.screen)){const target=navigateTeaching(ROOT,el.dataset.target);if(target&&event.detail>0)sceneSourcePointerTarget=focusTarget();}break;}case 'opportunity-route':navigatePlanningOpportunity(el.dataset.id);if(event.detail>0)sceneSourcePointerTarget=focusTarget();break;case 'opportunity-return':restorePlanningOpportunity();if(event.detail>0)sceneSourcePointerTarget=focusTarget();break;
 case 'visit':{const fromScene=!!sceneSourceOrigin();rememberReading(el);rememberEnding(el);const cellId=el.dataset.cell||ui.selected;if(!getSceneVisit(state,cellId)?.available)throw Error('这里没有可回访的现场。');const changed=ui.selected!==cellId;ui.selected=cellId;go('visit');if(fromScene&&event.detail>0)sceneSourcePointerTarget=focusTarget();if(changed)mapView=null;break;}case 'avg':if(state.phase!=='planning')throw Error('现在不是介入窗口。');if(el.hasAttribute('data-resume-contract')&&['choice','confirm'].includes(ui.screen)){const target=resumeSceneContract();if(target&&event.detail>0)sceneSourcePointerTarget=focusTarget();}else if(['choice','confirm'].includes(ui.screen))restoreScenePreview();else go('avg');break;case 'resume-contract':{if(!['choice','confirm'].includes(ui.screen))break;const target=resumeSceneContract();if(target&&event.detail>0)sceneSourcePointerTarget=focusTarget();break;}case 'scene-section':focusSceneSection(el.dataset.section);break;case 'scene-choice':{if(ui.screen!=='avg'||state.phase!=='planning'||!actions().some(a=>a.id===el.dataset.id))break;const target=ROOT.querySelector(`[data-planning-choices] [data-action="choose"][data-id="${CSS.escape(el.dataset.id)}"]`);if(target){scenePointerJump=event.detail>0?el.dataset.id:false;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});}break;}case 'evidence':{const s=session();if(s.budget<evidenceCost(state,el.dataset.id)||s.evidence.includes(el.dataset.id))break;if(usesTradeoffs(state))investigate(state,selectedActor().id,ui.selected,el.dataset.id);else{s.evidence.push(el.dataset.id);s.budget--;}render({focusTo:`[data-evidence-id="${CSS.escape(el.dataset.id)}"] > summary`});break;}case 'preview-evidence':{const id=el.dataset.id;const origin=createEvidenceBookmark(state,bookmarkContext(),id,session().evidence);if(!origin)break;evidenceBookmark=origin;go('avg');const details=ROOT.querySelector(`[data-evidence-id="${CSS.escape(id)}"]`);if(details){details.open=true;details.querySelector('summary')?.focus();}break;}case 'evidence-return':{const origin=readEvidenceBookmark(evidenceBookmark,state,bookmarkContext(),session().evidence);if(!origin){evidenceBookmark=null;break;}ui.choice=origin.actionId;go('choice');evidenceReturnPointer=event.detail>0;break;}case 'choose':{const fromConfirm=ui.screen==='confirm';evidenceBookmark=null;rememberScenePreview(el);ui.choice=el.dataset.id;go('choice');if(fromConfirm&&event.detail>0)sceneSourcePointerTarget=focusTarget();break;}case 'confirm':go('confirm');break;case 'lock':if(!getActionPreview(state,ui.selected,selectedActor().id,ui.choice,session().evidence)?.canLock)throw Error('尚缺必要证据，请先回现场取证。');lockTask(state,selectedActor().id,ui.selected,ui.choice,session().evidence);go('window');break;case 'window':go('window');break;case 'review-jump':if(ui.screen==='window'&&state.phase==='planning'){const target=navigateWindowReadiness(ROOT,el.dataset.target);if(target&&event.detail>0)sceneSourcePointerTarget=focusTarget();}break;case 'edit-draft':{const context=getDraftEditContext(state,el.dataset.actor);if(!context||ui.screen!=='window')break;ui.actor=context.actorId;if(context.cellId){ui.selected=context.cellId;mapView=null;}draftEdit={state,year:state.year,actorId:context.actorId};go(context.cellId?'avg':'world');if(event.detail>0)sceneSourcePointerTarget=focusTarget();break;}case 'draft-edit-return':if(draftEdit){draftEdit=null;go('window');if(event.detail>0)sceneSourcePointerTarget=focusTarget();}break;case 'unlock':unlockTask(state,el.dataset.actor);ui.actor=el.dataset.actor;go('world');break;case 'assign':ui.actor=el.dataset.actor;go('world');break;case 'pass':passTask(state,el.dataset.actor);render();break;case 'commit':playbackNotice='';commitWindow(state);save();go('playback');break;
 case 'playback':go('playback');break;case 'review':go('review');break;case 'reading-return':restoreReading();break;case 'scene-source-return':{const target=restoreSceneSource();sceneSourcePointerTarget=event.detail>0?target:null;break;}case 'next-record':if(event.detail<=1){advanceToRecord();playbackPointerAdvance=event.detail>0;}break;case 'step':stop();advance();break;case 'skip':stop();advanceToNextWindow(state);save();go('review');break;case 'auto':stop();playbackNotice='';timer=setInterval(()=>{if(storageBusy||storageReadOnly()||saveWriter.snapshot().pending){stop();return;}try{advance({automatic:true});}catch(e){stop();message(e.message);}},900);render();break;case 'pause':stop();playbackNotice='';render();break;case 'pause-world':stop();go('world');break;case 'ending':go('ending');break;case 'ending-return':restoreEnding();break;case 'cell-history':ui.cellHistory=true;go('archive');break;case 'toggle-history':ui.cellHistory=!ui.cellHistory;render();break;case 'trace':{if(['playback','review'].includes(ui.screen)&&!journalSourceKnown(el.dataset.id))throw Error('来源链缺失或不一致，不能据此打开未核实的来源。');const fromScene=rememberSceneSource(el)||!!sceneSourceOrigin();rememberReading(el);rememberEnding(el);ui.traceId=el.dataset.id;go('trace');if(fromScene&&event.detail>0)sceneSourcePointerTarget=focusTarget();break;}case 'trace-map':ui.mapTrace=traceEvent(state,ui.traceId);go('world');break;
 case 'text-size':ui.bigText=!ui.bigText;render();break;case 'export':{const blob=new Blob([JSON.stringify({state,ui},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`afterwave-y${state.year}-seed${state.seed}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);break;}case 'new-confirm':{if(ui.screen!=='settings')break;const input=ROOT.querySelector('#seed');if(!input)break;const raw=input.value,seed=raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):12;pendingNewRun={state,raw,seed};ROOT.querySelector('#reset-confirm').innerHTML=`<div class="notice new-run-confirm" data-new-run-confirm role="status"><h3>确认这段新历史</h3><p>新世界种子：<strong data-new-run-seed>${esc(seed)}</strong>。这会替换当前第 ${state.year} 年的进度，建议先导出存档。修改种子后需要重新确认。</p>${button('确认开始新历史','new-run')}</div>`;break;}case 'new-run':{const request=pendingNewRun,input=ROOT.querySelector('#seed');if(ui.screen!=='settings'||!request||request.state!==state||!input||input.value!==request.raw){cancelNewRun();break;}cancelNewRun();cancelImport();stop();readingReturn=null;playbackNotice='';mapView=null;const replacement={state:createRun(request.seed),ui:{...ui,screen:'world',selected:'D4',actor:'protagonist',focus:false,sessions:{},mapTrace:null}};storageBusy=true;try{await persist(replacement);({state,ui}=replacement);go('world');}finally{storageBusy=false;refreshStorageStatus();}break;}
 }}catch(e){suppressAutoSave=true;try{message(e.message||'操作未完成。当前进度仍保留。');}finally{suppressAutoSave=false;}}});
ROOT.addEventListener('input',e=>{if(storageBusy)return;if(e.target.id==='seed')cancelNewRun();if(e.target.id==='search'){const pos=e.target.selectionStart;ui.query=e.target.value;render();const input=document.querySelector('#search');input.focus();input.setSelectionRange(pos,pos);}});
ROOT.addEventListener('change',async e=>{if(e.target.id!=='import-save'||ui.screen!=='settings'||storageBusy||storageReadOnly())return;
 const file=e.target.files?.[0];if(!file)return;let ownsStorage=false;
 cancelNewRun();recoveryConfirm=false;const request=importRequests.begin();setImportReading(true);
 try{
  if(file.size>5_000_000)throw Error('存档文件过大。');
  const text=await file.text();if(!importRequests.isCurrent(request))return;
  const restored=restoreSave(JSON.parse(text),{imported:true});
  if(!importRequests.isCurrent(request))return;
  ownsStorage=true;storageBusy=true;if(startupGuard.blocked)await startupGuard.replace(restored);else if(!await persist(restored))throw Error('保存被阻止。');
  cancelImport();stop();readingReturn=null;playbackNotice='';mapView=null;({state,ui}=restored);saveIssue='';go('world');
  message(`已导入。后续缺岗规则：${getStaffingRulesVersion(state)==='station-only-v1'?'仅测站':'D4测站与档案站'}；既有结算不回写，已停运机构不复活。详情见设置。`);
 }catch(err){if(!importRequests.isCurrent(request))return;cancelImport();if(startupGuard.blocked){recoveryError=err.message;render();}else {suppressAutoSave=true;try{message(ownsStorage?'导入未保存，当前进度未切换。'+err.message:err.message);}finally{suppressAutoSave=false;}}}finally{if(ownsStorage)storageBusy=false;refreshStorageStatus();}
});
window.addEventListener('pagehide',()=>{cancelNewRun();cancelImport();stop();saveWriter.close();updateSaveIssue(storageReason('closed'));});
window.addEventListener('pageshow',event=>{if(event.persisted){stop();updateSaveIssue(storageReason('closed'));}});
window.addEventListener('storage',event=>{if(event.storageArea!==localStorage||(event.key!==KEY&&event.key!==null))return;const result=saveWriter.observeExternal();if(!result.ok){stop();cancelImport();updateSaveIssue(storageReason(result.reason));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){stop();playbackNotice='已暂停。返回后由你继续推进。';if(ui.screen==='playback')render();}});
window.afterwave={get storage(){return saveWriter.snapshot();},get state(){return state;},get ui(){return ui;},get mapView(){return board?.view()||mapView;},snapshot:()=>JSON.parse(JSON.stringify(state)),navigate:screen=>{if(!storageBusy)go(screen);}};
if(storageReadOnly())updateSaveIssue(storageReason('unsupported'));
render({persist:startupGuard.needsInitialSave});
refreshStorageStatus();
