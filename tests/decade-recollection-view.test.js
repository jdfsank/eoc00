import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDecadeRecollection, renderDecadeSettlement} from '../src/decade-recollection-view.js';
import {getStageDecadeReview} from '../src/stage-decade-review.js';
import {getPlaybackJournal} from '../src/playback-journal.js';
import * as sim from '../src/simulation.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sample = () => ({title:'上一段 <历史>',summary:'原文 & 不变',cards:[{actorId:'protagonist',name:'主角',choice:'选择 <script> & "一"',outcome:'结果\n第二行',responsibility:'责任，没有被删去。',sourceIds:['action:0:protagonist:D4:build_joint','原页"<>&\'']}]});
const settlement = () => ({year:30,start:20,isBoundary:true,turns:[{id:'crisis-impact',year:23,category:'crisis',title:'原始清点',record:{id:'crisis-impact',year:23,kind:'crisis',status:'confirmed',reality:'R1',text:'清点原文 < & " >，不改数字。'}}]});

test('recollection retains complete source text in three semantic rows and exact trace targets', () => {
  const view = freeze(sample()), before = JSON.stringify(view), html = renderDecadeRecollection(view);
  for (const text of [view.title,view.summary,view.cards[0].name,...['choice','outcome','responsibility'].map(key=>view.cards[0][key])]) assert.ok(html.includes(escape(text)));
  for (const label of ['上次的选择：','这些年：','留下的责任：']) assert.ok(html.includes(`<dt>${label}</dt>`));
  for (const [index,id] of view.cards[0].sourceIds.entries()) assert.ok(html.includes(`<button class="text-button" data-action="trace" data-id="${escape(id)}">查看本段来源 ${index+1}</button>`));
  assert.match(html, /class="decade-recollection"/);
  assert.match(html, /data-decade-actor="protagonist"/);
  assert.doesNotMatch(html, /<script>|data-journal-record/);
  assert.equal(JSON.stringify(view), before);
});

test('null and incomplete inputs never print undefined or manufacture paragraphs', () => {
  for (const view of [null,undefined,{}, {cards:null}]) assert.equal(renderDecadeRecollection(view),'');
  const html = renderDecadeRecollection({cards:[null,{}, {actorId:'a"<',sourceIds:[null,2,'valid']} ]});
  assert.doesNotMatch(html,/undefined|null|data-decade-actor="a"</);
  assert.match(html,/data-decade-actor="a&quot;&lt;"/);
});

test('actual pass, missing-source unknown and terminal responsibility survive unchanged', () => {
  const state = sim.createRun(0);
  for (let year=10;year<=40;year+=10) {
    for (const actor of sim.getActors(state)) sim.passTask(state,actor.id);
    sim.commitWindow(state); sim.advanceToNextWindow(state);
    const views = [getStageDecadeReview(state)];
    const missing = structuredClone(state);
    missing.history = missing.history.filter(row=>row.id!==`pass:${year-10}:protagonist`);
    views.push(getStageDecadeReview(missing));
    for (const view of views) {
      const before=JSON.stringify(view), html=renderDecadeRecollection(freeze(view));
      for (const card of view.cards) for (const key of ['choice','outcome','responsibility']) assert.ok(html.includes(escape(card[key])),`${year}/${key}`);
      assert.equal(JSON.stringify(view),before);
    }
    if (year===40) assert.match(renderDecadeRecollection(views[0]),/本阶段的介入已经结束/);
  }
});

test('settlement renders only saved text and original source without duplicate journal identity', () => {
  const view=freeze(settlement()), before=JSON.stringify(view), html=renderDecadeSettlement(view);
  assert.ok(html.includes(escape(view.turns[0].record.text)));
  assert.match(html,/同一段历史里的清点/);
  assert.match(html,/data-action="trace" data-id="crisis-impact"/);
  assert.doesNotMatch(html,/data-journal-record|data-decade-actor|主角|林澈/);
  assert.equal(JSON.stringify(view),before);
});

test('settlement omits missing, contradictory, duplicated and outside-period evidence', () => {
  const variants=[null,{}, {...settlement(),year:20}, {...settlement(),isBoundary:false}, {...settlement(),turns:[]}, {...settlement(),year:40,start:30}];
  for (const change of [t=>{t.category='unknown';},t=>{t.record.text=undefined;},t=>{t.record.kind='outcome';},t=>{t.record.status='pending';},t=>{t.record.reality='R0';},t=>{t.record.id='other';},t=>{t.record.year=22;},t=>{t.year=31;}]) {
    const view=settlement();change(view.turns[0]);variants.push(view);
  }
  for (const duplicate of [{...settlement().turns[0]}, {...settlement().turns[0],category:'unknown'}, {...settlement().turns[0],id:'another-crisis'}]) {
    const view=settlement();view.turns.push(duplicate);variants.push(view);
  }
  for (const view of variants) assert.equal(renderDecadeSettlement(view),'');
});

test('actual journal includes year23 only in its own decade; flags cannot fill missing historical text', () => {
  const state=sim.createRun(0);
  for(let year=10;year<=40;year+=10) {
    sim.passTask(state,'protagonist');sim.commitWindow(state);sim.advanceToNextWindow(state);
    const journal=getPlaybackJournal(state), html=renderDecadeSettlement(journal);
    if(year===30) {
      const original=state.history.find(row=>row.id==='crisis-impact');
      assert.ok(html.includes(escape(original.text)));
      const missing=structuredClone(state);missing.history=missing.history.filter(row=>row.id!=='crisis-impact');
      assert.equal(renderDecadeSettlement(getPlaybackJournal(missing)),'');
    } else assert.equal(html,'');
  }
});
