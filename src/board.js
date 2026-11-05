import Phaser from 'phaser';
import {heatColor,institutionVisual} from './board-visuals.js';

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
   detail.lineStyle(2,ink);detail.lineBetween(x-19,y-11,x-10,y-11);detail.lineBetween(x-19,y-7,x-10,y-7);
   if(visual.unverified){detail.fillStyle(amber);detail.fillTriangle(x-12,y-5,x-5,y-5,x-5,y+2);}
  }else{
   detail.fillStyle(ink);detail.fillRect(x-19,y-11,4,3);detail.fillRect(x-13,y-11,4,3);
   if(!visual.degraded){detail.fillRect(x-19,y-6,4,3);detail.fillRect(x-13,y-6,4,3);}
   else {detail.lineStyle(1,ink);detail.strokeRect(x-19,y-6,10,3);}
  }
 }
 if(visual.degraded){
  const {x,y}=p;
  // A roof patch plus an empty shift, not a complete building replacement.
  detail.fillStyle(wood);detail.fillPoints([{x:x-14,y:y-30},{x:x-5,y:y-34},{x:x+3,y:y-30},{x:x-6,y:y-26}],true);
  detail.lineStyle(1,ink);detail.lineBetween(x-9,y-31,x-1,y-28);
 }
 if(visual.restricted){
  const {x,y}=p;
  // A closed access bar describes the fee threshold, not a crisis outcome.
  detail.lineStyle(3,wood);detail.lineBetween(x+2,y+3,x+2,y+12);detail.lineBetween(x+17,y+10,x+17,y+19);
  detail.lineStyle(3,amber);detail.lineBetween(x+2,y+5,x+17,y+12);
 }
 return detail;
}
export const project = (c,r) => ({x:288+(c-r)*32,y:60+(c+r)*16});
export function hitTile(x,y){ const a=(x-288)/32,b=(y-60)/16;const c=Math.floor((a+b)/2+0.5),r=Math.floor((b-a)/2+0.5);return c>=0&&c<8&&r>=0&&r<8?String.fromCharCode(65+c)+(r+1):null; }
export function makeBoard(parent,onSelect,initialView=null){
 let latest=null,scene=null,focus=!!initialView?.focus,destroyed=false,drag=null;
 let center=initialView&&Number.isFinite(initialView.centerX)&&Number.isFinite(initialView.centerY)?{x:initialView.centerX,y:initialView.centerY}:null;
 const rememberCenter=()=>{if(scene){const camera=scene.cameras.main;center={x:camera.scrollX+camera.width/2,y:camera.scrollY+camera.height/2};}return center;};
 class World extends Phaser.Scene{
  preload(){ for(const name of ['agent','archive','assembly_hall','observatory','temple','tree','warehouse','water_station','riverside_school','bank_reading_circle']) this.load.image(name,`${import.meta.env.BASE_URL}assets/props/${name}.png`); }
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
    if(prop&&this.textures.exists(prop)){const spr=this.add.image(p.x,p.y,prop).setOrigin(.5,.8).setDisplaySize(64,80);this.layer.add(spr);if(visual?.halted)spr.setTint(0x7d8981);else if(visual?.degraded)spr.setTint(0xc3b394);if(obscures)spr.setAlpha(.35);}
    if(visual)drawInstitutionTrace(this,this.layer,p,visual).setAlpha(obscures?.35:1);
    if((c.id==='D4'||c.id==='E4'||c.id==='F6')&&state.events.some(e=>e.cellId===c.id&&e.status==='pending')){this.layer.add(this.add.text(p.x+20,p.y-26,'◆',{fontSize:'14px',color:'#e0b65f'}));}
   }
   {const c=state.cells.find(c=>c.id===selected); if(c){const p=project(c.col,c.row);    if(c.id===selected){const sel=this.add.graphics();sel.lineStyle(3,0xf6ecc8);sel.strokePoints([{x:p.x,y:p.y-16},{x:p.x+32,y:p.y},{x:p.x,y:p.y+16},{x:p.x-32,y:p.y}],true);this.layer.add(sel);this.layer.add(this.add.text(p.x,p.y+23,c.id,{fontFamily:'monospace',fontSize:'15px',color:'#f6ecc8',backgroundColor:'#18383e'}).setOrigin(.5,0).setPadding(4,1));}
}}
   for(let i=0;i<8;i++){const a=project(i,0),b=project(0,i);this.layer.add(this.add.text(a.x+10,a.y-35,String.fromCharCode(65+i),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));this.layer.add(this.add.text(b.x-43,b.y-6,String(i+1),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));}
   this.frame();
  }
 }
 const game=new Phaser.Game({type:Phaser.CANVAS,parent,transparent:true,width:parent.clientWidth,height:parent.clientHeight,scene:World,pixelArt:true,antialias:false,audio:{noAudio:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},render:{roundPixels:true},fps:{target:30}});
 return {update(state,selected,channel,trace=null){latest={state,selected,channel,trace};scene?.draw();},focus(value){if(focus!==value){focus=value;center=null;scene?.draw();}},recenter(){center=null;scene?.frame();},view(){const current=rememberCenter();return current?{focus,centerX:current.x,centerY:current.y,zoom:scene?.cameras.main.zoom||initialView?.zoom||1}:null;},destroy(){if(!destroyed){destroyed=true;game.destroy(true);}},game};
}
