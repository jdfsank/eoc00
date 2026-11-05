import Phaser from 'phaser';
const COLORS = {politics:0xe18c76,economy:0xdfc36b,science:0x72c1b5,religion:0xb7a4da};
export const project = (c,r) => ({x:288+(c-r)*32,y:60+(c+r)*16});
export function hitTile(x,y){ const a=(x-288)/32,b=(y-60)/16;const c=Math.floor((a+b)/2+0.5),r=Math.floor((b-a)/2+0.5);return c>=0&&c<8&&r>=0&&r<8?String.fromCharCode(65+c)+(r+1):null; }
export function makeBoard(parent,onSelect,initialView=null){
 let latest=null,scene=null,focus=!!initialView?.focus,destroyed=false,drag=null;
 let center=initialView&&Number.isFinite(initialView.centerX)&&Number.isFinite(initialView.centerY)?{x:initialView.centerX,y:initialView.centerY}:null;
 const rememberCenter=()=>{if(scene){const camera=scene.cameras.main;center={x:camera.scrollX+camera.width/2,y:camera.scrollY+camera.height/2};}return center;};
 class World extends Phaser.Scene{
  preload(){ for(const name of ['agent','archive','assembly_hall','observatory','temple','tree','warehouse','water_station']) this.load.image(name,`${import.meta.env.BASE_URL}assets/props/${name}.png`); }
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
   for(const c of cells){const {x,y}=project(c.col,c.row);const water=c.terrain==='water';const base=water?0x35666a:c.terrain==='paved'?0x8a8e79:0x6a8170;const col=Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(base),Phaser.Display.Color.IntegerToColor(COLORS[channel]),100,c.channels[channel]*0.29);poly([{x,y:y-16},{x:x+32,y},{x,y:y+16},{x:x-32,y}],Phaser.Display.Color.GetColor(col.r,col.g,col.b));
    g.lineStyle(1,water?0x8bb8ad:0xadc198,0.3);if(water){g.lineBetween(x-12,y-1,x+6,y-1);g.lineBetween(x-2,y+6,x+14,y+6);}else{g.lineBetween(x-11,y+4,x-7,y+4);if((c.row+c.col)%3===0)g.lineBetween(x+8,y-2,x+11,y-2);}
   }
   if(trace){const pts=trace.map(e=>state.cells.find(c=>c.id===e.cellId)).filter(Boolean).map(c=>project(c.col,c.row));g.lineStyle(4,0xe0b65f,0.8);if(pts.length>1)g.strokePoints(pts,false);for(const p of pts){g.fillStyle(0xe0b65f);g.fillCircle(p.x,p.y,5);}}
   for(const c of cells){const p=project(c.col,c.row);let prop=c.prop;const inst=state.institutions.filter(i=>i.cellId===c.id&&i.active!==false);if(inst.length)prop=inst.some(i=>/station|branch/.test(i.type||i.kind||i.id))?'water_station':inst.some(i=>/school|training/.test(i.type||i.kind||i.id))?'observatory':prop||'archive';if(prop&&this.textures.exists(prop)){const spr=this.add.image(p.x,p.y,prop).setOrigin(.5,.8).setDisplaySize(64,80);this.layer.add(spr);if(inst.some(i=>i.maintenance===false||i.active===false))spr.setTint(0x8b765e);}
    if((c.id==='D4'||c.id==='E4'||c.id==='F6')&&state.events.some(e=>e.cellId===c.id&&e.status==='pending')){this.layer.add(this.add.text(p.x+20,p.y-26,'◆',{fontSize:'14px',color:'#e0b65f'}));}
   }
   {const c=state.cells.find(c=>c.id===selected); if(c){const p=project(c.col,c.row);    if(c.id===selected){const sel=this.add.graphics();sel.lineStyle(3,0xf6ecc8);sel.strokePoints([{x:p.x,y:p.y-16},{x:p.x+32,y:p.y},{x:p.x,y:p.y+16},{x:p.x-32,y:p.y}],true);this.layer.add(sel);this.layer.add(this.add.text(p.x,p.y+23,c.id,{fontFamily:'monospace',fontSize:'15px',color:'#f6ecc8',backgroundColor:'#18383e'}).setOrigin(.5,0).setPadding(4,1));}
}}
   for(let i=0;i<8;i++){const a=project(i,0),b=project(0,i);this.layer.add(this.add.text(a.x+10,a.y-35,String.fromCharCode(65+i),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));this.layer.add(this.add.text(b.x-43,b.y-6,String(i+1),{fontSize:'13px',fontFamily:'monospace',color:'#b5c9b9'}));}
   this.frame();
  }
 }
 const game=new Phaser.Game({type:Phaser.CANVAS,parent,transparent:true,width:parent.clientWidth,height:parent.clientHeight,scene:World,pixelArt:true,antialias:false,audio:{noAudio:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},render:{roundPixels:true},fps:{target:30}});
 return {update(state,selected,channel,trace=null){latest={state,selected,channel,trace};scene?.draw();},focus(value){if(focus!==value){focus=value;center=null;scene?.frame();}},recenter(){center=null;scene?.frame();},view(){const current=rememberCenter();return current?{focus,centerX:current.x,centerY:current.y,zoom:scene?.cameras.main.zoom||initialView?.zoom||1}:null;},destroy(){if(!destroyed){destroyed=true;game.destroy(true);}},game};
}
