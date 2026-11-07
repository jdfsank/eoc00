// Failure-only, read-only observations. No click, scroll, focus, style or world writes.
// The host deadline also covers an unresponsive renderer; lack of data is not a pass.
export async function collectActionabilityDiagnostic(page,{timeoutMs=600,frameWindowMs=120}={}) {
  let timer;
  const unavailable=reason=>({status:'unavailable',reason});
  try {
    const observation=page.evaluate(async frameWindowMs=>{
      const sample=()=>{
        const target=document.querySelector('[data-action="list"]'),rect=target?.getBoundingClientRect();
        const center=rect?{x:rect.x+rect.width/2,y:rect.y+rect.height/2}:null;
        const inViewport=!!center&&center.x>=0&&center.x<innerWidth&&center.y>=0&&center.y<innerHeight;
        const hit=inViewport?document.elementFromPoint(center.x,center.y):null;
        const describe=e=>e?{tag:e.tagName,id:e.id,action:e.getAttribute('data-action'),className:e.getAttribute('class')}:null;
        const style=target?getComputedStyle(target):null;
        return {visibility:document.visibilityState,focused:document.hasFocus(),viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},target:target?{connected:target.isConnected,disabled:target.disabled,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},style:{display:style.display,visibility:style.visibility,opacity:style.opacity},centerInViewport:inViewport,centerHit:describe(hit),centerHitsTarget:!!hit&&(hit===target||target.contains(hit))}:null,activeElement:describe(document.activeElement),boardHeight:document.querySelector('#board')?.clientHeight??null,canvasCount:document.querySelectorAll('#board canvas').length};
      };
      const before=sample();let frames=0,raf,timer;
      const outcome=await new Promise(resolve=>{
        timer=setTimeout(()=>resolve('frame-window-expired'),frameWindowMs);
        const tick=()=>{frames++;if(frames>=2)resolve('two-animation-frames');else raf=requestAnimationFrame(tick);};
        raf=requestAnimationFrame(tick);
      });
      clearTimeout(timer);cancelAnimationFrame(raf);
      return {status:'observed',frameObservation:{outcome,frames,windowMs:frameWindowMs},before,after:sample()};
    },frameWindowMs).catch(error=>unavailable(`evaluation failed: ${error.message}`));
    return await Promise.race([observation,new Promise(resolve=>{timer=setTimeout(()=>resolve(unavailable(`host deadline ${timeoutMs}ms exceeded`)),timeoutMs);})]);
  } catch(error) {return unavailable(`collection failed: ${error.message}`);}
  finally {clearTimeout(timer);}
}
