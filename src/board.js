import {getCrisisRegions,CRISIS_MARKER_OFFSET} from './crisis-regions.js';
import {STATION_ACCESS_ASSETS} from './station-access-visuals.js';
import {MONASTERY_ASSETS} from './monastery-visuals.js';
import {FAR_PORT_ASSETS} from './far-port-visuals.js';
import Phaser from 'phaser';
import {SOUTH_BANK_ASSETS} from './south-bank-visuals.js';
import {heatColor,institutionVisual,mapActivity} from './board-visuals.js';

// Small, hard-edged physical traces stay within their owner's footprint.
// All markers supplement the selected region's equivalent text description.
function drawInstitutionTrace(scene,layer,p,visual){
 const detail=scene.add.graphics();layer.add(detail);
 const x=p.x+14,y=p.y+12,ink=0x233c3b,paper=0xe0d6b7,wood=0x9e8b63,amber=0xe0b65f;
 detail.lineStyle(2,ink,1);
 if(visual.kind==='warning'){
  // A residents' bell is deliberately not the station's measuring tower.
  detail.fillStyle(wood);detail.fillRect(x-18,y-26,3,34);detail.fillRect(x-18,y-26,15,3);
  detail.fillStyle(paper);detail.fillRect(x-10,y-19,5,7);detail.fillRect(x-12,y-12,9,3);
  detail.fillStyle(ink);detail.fillRect(x-8,y-9,2,3);
 }else{
  // Notice/duty board. Empty slots and a shutter remain legible without color.
  detail.fillStyle(wood);detail.fillRect(x-23,y-15,3,24);detail.fillRect(x-9,y-15,3,24);
  detail.fillStyle(ink);detail.fillRect(x-24,y-17,19,18);
  detail.fillStyle(visual.halted?0x6e7770:paper);detail.fillRect(x-22,y-15,15,14);
  if(visual.halted){
   detail.lineStyle(3,wood);detail.lineBetween(x-22,y-14,x-8,y-2);detail.lineBetween(x-22,y-2,x-8,y-14);
  }else if(visual.recordsOnly){
   detail.lineStyle(2,ink);detail.lineBetween(x-19,y-11,x-10,y-11);
   if(visual.staffingGap){detail.lineStyle(1,ink);detail.strokeRect(x-19,y-7,10,3);}
   else detail.lineBetween(x-19,y-7,x-10,y-7);
   if(visual.unverified){detail.fillStyle(amber);detail.fillTriangle(x-12,y-5,x-5,y-5,x-5,y+2);}
  }else{
   detail.fillStyle(ink);detail.fillRect(x-19,y-11,4,3);detail.fillRect(x-13,y-11,4,3);
   if(!visual.staffingGap){detail.fillRect(x-19,y-6,4,3);detail.fillRect(x-13,y-6,4,3);}
   else {detail.lineStyle(1,ink);detail.strokeRect(x-19,y-6,10,3);}
  }
 }
 if(visual.maintenanceGap){
  const {x,y}=p;
  // Physical maintenance alone adds a roof patch. Staffing uses the board.
  detail.fillStyle(wood);detail.fillPoints([{x:x-14,y:y-30},{x:x-5,y:y-34},{x:x+3,y:y-30},{x:x-6,y:y-26}],true);
  detail.lineStyle(1,ink);detail.lineBetween(x-9,y-31,x-1,y-28);
 }
 if(visual.restricted&&!visual.stationAccess){
  const {x,y}=p;
  // A closed access bar describes the fee threshold, not a crisis outcome.
  detail.lineStyle(3,wood);detail.lineBetween(x+2,y+3,x+2,y+12);detail.lineBetween(x+17,y+10,x+17,y+19);
  detail.lineStyle(3,amber);detail.lineBetween(x+2,y+5,x+17,y+12);
 }
 return detail;
}
function drawActivity(scene,layer,p,activities){
 const drafts=activities.filter(item=>item.kind==='draft'),pending=activities.filter(item=>item.kind==='pending');
 const marks=[...drafts,...(pending.length?[{kind:'pending',shape:'hourglass',count:pending.length}]:[])];
 marks.forEach((mark,index)=>{
  // Annotation chips float above the place. A dashed tether describes an
  // intention or wait, not a new permanent structure on the ground.
  const x=p.x+18+(index-(marks.length-1)/2)*24,y=p.y-40,ink=0x18383e,paper=0xf6ecc8;
  const g=scene.add.graphics();layer.add(g);g.setName(`map-activity:${mark.kind}:${mark.actorId||'events'}`);
  g.lineStyle(2,paper);for(let n=0;n<3;n++)g.lineBetween(x,y+12+n*5,x,y+14+n*5);
  g.fillStyle(ink);g.lineStyle(2,paper);
  if(mark.shape==='circle'){g.fillCircle(x,y,9);g.strokeCircle(x,y,9);}
  else if(mark.shape==='square'){g.fillRect(x-9,y-9,18,18);g.strokeRect(x-9,y-9,18,18);}
  else{
   g.fillRect(x-10,y-10,20,20);g.strokeRect(x-10,y-10,20,20);
   g.lineStyle(2,paper);g.lineBetween(x-5,y-6,x+5,y-6);g.lineBetween(x-5,y+6,x+5,y+6);
   g.lineBetween(x-5,y-6,x+5,y+6);g.lineBetween(x+5,y-6,x-5,y+6);
   if(mark.count>1)layer.add(scene.add.text(x+10,y-16,String(mark.count),{fontFamily:'monospace',fontSize:'10px',color:'#f6ecc8',backgroundColor:'#18383e'}).setPadding(1));
  }
 });
}
function drawCrisisRecord(scene,layer,p,record){
 const x=p.x+CRISIS_MARKER_OFFSET.x,y=p.y+CRISIS_MARKER_OFFSET.y,g=scene.add.graphics();layer.add(g);
 g.setName(`map-crisis:${record.cellId}:${record.status}`);g.setData({cellId:record.cellId,status:record.status});
 const ink=0x18383e,paper=0xf6ecc8;g.fillStyle(ink);g.lineStyle(2,paper);
 if(record.status==='warning'){
  g.fillTriangle(x,y-9,x-9,y+8,x+9,y+8);g.strokeTriangle(x,y-9,x-9,y+8,x+9,y+8);
  g.lineBetween(x,y-3,x,y+2);g.fillStyle(paper);g.fillRect(x-1,y+5,2,2);
 }else if(record.status==='unknown'){
  g.fillRect(x-8,y-9,16,18);
  for(let n=-7;n<8;n+=6){g.lineBetween(x+n,y-9,x+n+3,y-9);g.lineBetween(x+n,y+9,x+n+3,y+9);}
  for(let n=-7;n<8;n+=6){g.lineBetween(x-9,y+n,x-9,y+n+3);g.lineBetween(x+9,y+n,x+9,y+n+3);}
  g.lineBetween(x-3,y-4,x+3,y-4);g.lineBetween(x+3,y-4,x+3,y);g.lineBetween(x+3,y,x,y);g.lineBetween(x,y,x,y+3);g.fillStyle(paper);g.fillRect(x-1,y+6,2,2);
 }else{
  const pts=[{x:x-8,y:y-10},{x:x+3,y:y-10},{x:x+8,y:y-5},{x:x+8,y:y+10},{x:x-8,y:y+10}];
  g.fillPoints(pts,true);g.strokePoints(pts,true);g.lineBetween(x+3,y-10,x+3,y-5);g.lineBetween(x+3,y-5,x+8,y-5);
  g.lineBetween(x-4,y-5,x,y-5);
  if(record.status==='zero'){g.strokeCircle(x,y+3,4);}
  else{g.fillStyle(paper);g.fillPoints([{x,y:y-1},{x:x+4,y:y+3},{x,y:y+7},{x:x-4,y:y+3}],true);}
 }
 return g;
}
function drawSouthBankUpkeep(scene,layer,p,south){
 const g=scene.add.graphics();layer.add(g);
 // Keep each repair on its own object. A teaching gap never damages the shed.
 if(south.aid.maintenanceGap){
  const x=p.x+(south.teaching.exists?11:0),y=p.y-27;
  g.fillStyle(0xb5a37b);g.fillPoints([{x:x-5,y:y-3},{x:x+1,y:y-6},{x:x+7,y:y-3},{x:x+1,y}],true);
  g.lineStyle(1,0x233c3b);g.lineBetween(x-1,y-4,x+4,y-1);
 }
 if(south.teaching.maintenanceGap){g.lineStyle(2,0xb5a37b);g.lineBetween(p.x-20,p.y+1,p.x-10,p.y+6);}
 return g;
}
function drawFarPortUpkeep(scene,layer,p,port){
 const g=scene.add.graphics();layer.add(g);
 if(port.branch.maintenanceGap){g.fillStyle(0xb5a37b);g.fillPoints([{x:p.x-17,y:p.y-31},{x:p.x-11,y:p.y-35},{x:p.x-4,y:p.y-31},{x:p.x-10,y:p.y-27}],true);g.lineStyle(1,0x233c3b);g.lineBetween(p.x-13,p.y-32,p.x-7,p.y-29);}
 // Access gates are baked into the branch's own prop, independently of
 // maintenance and checking. Do not duplicate them with a generic fee bar.
 if(port.check.maintenanceGap){g.lineStyle(2,0xb5a37b);g.lineBetween(p.x+6,p.y+1,p.x+18,p.y-5);}
 return g;
}
export const project = (c,r) => ({x:288+(c-r)*32,y:60+(c+r)*16});
export function hitTile(x,y){ const a=(x-288)/32,b=(y-60)/16;const c=Math.floor((a+b)/2+0.5),r=Math.floor((b-a)/2+0.5);return c>=0&&c<8&&r>=0&&r<8?String.fromCharCode(65+c)+(r+1):null; }
export function makeBoard(parent,onSelect,initialView=null){
 let latest=null,scene=null,focus=!!initialView?.focus,destroyed=false,drag=null;
 let center=initialView&&Number.isFinite(initialView.centerX)&&Number.isFinite(initialView.centerY)?{x:initialView.centerX,y:initialView.centerY}:null;
 const rememberCenter=()=>{if(scene){const camera=scene.cameras.main;center={x:camera.scrollX+camera.width/2,y:camera.scrollY+camera.height/2};}return center;};
 class World extends Phaser.Scene{
  preload(){ for(const name of ['agent','archive','assembly_hall','observatory','temple','tree','warehouse','water_station','riverside_school','bank_reading_circle',...SOUTH_BANK_ASSETS,...FAR_PORT_ASSETS,...MONASTERY_ASSETS,...STATION_ACCESS_ASSETS]) this.load.image(name,`${import.meta.env.BASE_URL}assets/props/${name}.png`); }
  create(){ scene=this; this.layer=this.add.container(0,0); this.input.on('pointerdown',p=>{drag={x:p.x,y:p.y,cx:this.cameras.main.scrollX,cy:this.cameras.main.scrollY};});
   this.input.on('pointermove',p=>{if(p.isDown&&drag&&focus){this.cameras.main.scrollX=drag.cx-(p.x-drag.x)/this.cameras.main.zoom;this.cameras.main.scrollY=drag.cy-(p.y-drag.y)/this.cameras.main.zoom;rememberCenter();}});
   this.input.on('pointerup',p=>{if(!drag)return;const moved=Math.hypot(p.x-drag.x,p.y-drag.y);drag=null;if(moved<8){const w=this.cameras.main.getWorldPoint(p.x,p.y);const id=hitTile(w.x,w.y);if(id)onSelect(id);}});
   this.scale.on('resize',()=>this.frame()); this.draw();
  }
  frame(){if(!latest)return;const w=this.scale.width,h=this.scale.height;const z=Math.min(w/580,(h-14)/345)*(focus?2.5:1);if(!center){const tile=latest.state.cells.find(c=>c.id===latest.selected);const p=tile?project(tile.col,tile.row):{x:288,y:170};center=focus?{x:p.x,y:p.y-20}:{x:288,y:173};}this.cameras.main.setZoom(z);this.cameras.main.centerOn(center.x,center.y);}
  draw(){if(!latest||!this.layer)return;this.layer.removeAll(true);const {state,selected,channel,trace}=latest;const g=this.add.graphics();this.layer.add(g);
   const poly=(points,color,alpha=1,stroke=0x36544d)=>{g.fillStyle(color,alpha);g.lineStyle(1,stroke,0.8);g.fillPoints(points,true);g.strokePoints(points,true);};
   const cells=[...state.cells].sort((a,b)=>a.row+a.col-b.row-b.col||a.row-b.row);
   for(const c of cells){const {x,y}=project(c.col,c.row);if(c.col===7)poly([{x,y:y+16},{x:x+32,y},{x:x+32,y:y+11},{x,y:y+27}],0x294541);if(c.row===7)poly([{x:x-32,y},{x,y:y+16},{x,y:y+27},{x:x-32,y:y+11}],0x395852);}
   for(const c of cells){const {x,y}=project(c.col,c.row);const water=c.terrain==='water';const color=Number.parseInt(heatColor(channel,c.channels[channel]).slice(1),16);poly([{x,y:y-16},{x:x+32,y},{x,y:y+16},{x:x-32,y}],color);
    // Terrain survives all four heat layers through form, rather than a second
    // competing color scale. The five fill colors exactly match the legend.
    g.lineStyle(water?2:1,water?0xc2d8cf:0xc1ceb0,water?.65:.3);if(water){g.lineBetween(x-17,y-3,x+9,y-3);g.lineBetween(x-7,y+4,x+19,y+4);g.lineBetween(x-2,y+10,x+6,y+10);}else if(c.terrain==='paved'){g.lineBetween(x-15,y+1,x,y+8);g.lineBetween(x,y+8,x+15,y+1);}else{g.lineBetween(x-11,y+4,x-7,y+4);if((c.row+c.col)%3===0)g.lineBetween(x+8,y-2,x+11,y-2);}
   }
   if(trace){const pts=trace.map(e=>state.cells.find(c=>c.id===e.cellId)).filter(Boolean).map(c=>project(c.col,c.row));g.lineStyle(4,0xe0b65f,0.8);if(pts.length>1)g.strokePoints(pts,false);for(const p of pts){g.fillStyle(0xe0b65f);g.fillCircle(p.x,p.y,5);}}
   const chosen=state.cells.find(c=>c.id===selected),anchor=chosen?project(chosen.col,chosen.row):null;
   for(const c of cells){const p=project(c.col,c.row),visual=institutionVisual(state,c.id),prop=visual?.prop||c.prop;
    const obscures=focus&&anchor&&c.id!==selected&&p.y>anchor.y&&Math.abs(p.x-anchor.x)<56&&p.y-54<anchor.y+8;
    if(prop&&this.textures.exists(prop)){const spr=this.add.image(p.x,p.y,prop).setOrigin(.5,.8).setDisplaySize(64,80);this.layer.add(spr);if(!visual?.compound&&!visual?.farPort&&!visual?.monastery&&visual?.halted)spr.setTint(0x7d8981);else if(!visual?.compound&&!visual?.farPort&&!visual?.monastery&&visual?.maintenanceGap)spr.setTint(0xc3b394);if(obscures)spr.setAlpha(.35);}
    if(visual&&!visual.compound&&!visual.farPort&&!visual.monastery)drawInstitutionTrace(this,this.layer,p,visual).setAlpha(obscures?.35:1);
    if(visual?.compound)drawSouthBankUpkeep(this,this.layer,p,visual.compound).setAlpha(obscures?.35:1);
    if(visual?.farPort)drawFarPortUpkeep(this,this.layer,p,visual.farPort).setAlpha(obscures?.35:1);
   }
   {const c=state.cells.find(c=>c.id===selected); if(c){const p=project(c.col,c.row);    if(c.id===selected){const sel=this.add.graphics();sel.lineStyle(3,0xf6ecc8);sel.strokePoints([{x:p.x,y:p.y-16},{x:p.x+32,y:p.y},{x:p.x,y:p.y+16},{x:p.x-32,y:p.y}],true);this.layer.add(sel);this.layer.add(this.add.text(p.x+34,p.y+17,c.id,{fontFamily:'monospace',fontSize:'15px',color:'#f6ecc8',backgroundColor:'#18383e'}).setOrigin(0,0).setPadding(4,1));}
}}
   for(let i=0;i<8;i++){const a=project(i,0),b=project(0,i);this.layer.add(this.add.text(a.x+10,a.y-35,String.fromCharCode(65+i),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));this.layer.add(this.add.text(b.x-43,b.y-6,String(i+1),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));}
   // Render every place, including B4 and D5, above foreground buildings.
   // Existing institution traces and selection geometry remain underneath.
   // Record badges sit on the tile's left edge, separately from dispatch
   // chips above the roof. They never recolor or damage the real building.
   for(const record of getCrisisRegions(state).regions){const c=state.cells.find(c=>c.id===record.cellId);if(c)drawCrisisRecord(this,this.layer,project(c.col,c.row),record);}
   const activities=mapActivity(state);
   for(const c of cells){const local=activities.filter(item=>item.cellId===c.id);if(local.length)drawActivity(this,this.layer,project(c.col,c.row),local);}
   this.frame();
  }
 }
 const game=new Phaser.Game({type:Phaser.CANVAS,parent,transparent:true,width:parent.clientWidth,height:parent.clientHeight,scene:World,pixelArt:true,antialias:false,audio:{noAudio:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},render:{roundPixels:true},fps:{target:30}});
 return {update(state,selected,channel,trace=null){latest={state,selected,channel,trace};scene?.draw();},focus(value){if(focus!==value){focus=value;center=null;scene?.draw();}},recenter(){center=null;scene?.frame();},view(){const current=rememberCenter();return current?{focus,centerX:current.x,centerY:current.y,zoom:scene?.cameras.main.zoom||initialView?.zoom||1}:null;},destroy(){if(!destroyed){destroyed=true;game.destroy(true);}},game};
}
