import {performance} from 'node:perf_hooks';

// Read-only and failure-only. A responsive DOM after failure does not establish
// that Chromium's compositor/capture pipeline was responsive during the capture.
export async function collectScreenshotDiagnostic(page,{timeoutMs=600,frameWindowMs=120}={}) {
  let timer;
  const unavailable=reason=>({status:'unavailable',reason});
  try {
    const observation=Promise.resolve().then(()=>page.evaluate(async frameWindowMs=>{
      const snapshot=()=>({visibility:document.visibilityState,focused:document.hasFocus(),readyState:document.readyState,fontsStatus:document.fonts.status,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,devicePixelRatio},rootFontSize:getComputedStyle(document.documentElement).fontSize,canvasCount:document.querySelectorAll('canvas').length,boardCanvasCount:document.querySelectorAll('#board canvas').length});
      const before=snapshot();let frames=0,raf,deadline;
      const outcome=await new Promise(resolve=>{
        deadline=setTimeout(()=>resolve('frame-window-expired'),frameWindowMs);
        const tick=()=>{frames++;if(frames===2)resolve('two-animation-frames');else raf=requestAnimationFrame(tick)};
        raf=requestAnimationFrame(tick);
      });
      clearTimeout(deadline);cancelAnimationFrame(raf);
      return {status:'observed',before,after:snapshot(),frameObservation:{outcome,frames,windowMs:frameWindowMs}};
    },frameWindowMs)).catch(error=>unavailable(`evaluation failed: ${error.message}`));
    return await Promise.race([observation,new Promise(resolve=>{timer=setTimeout(()=>resolve(unavailable(`host deadline ${timeoutMs}ms exceeded`)),timeoutMs)})]);
  } catch(error) {return unavailable(`collection failed: ${error.message}`)}
  finally {clearTimeout(timer)}
}

// Only the existing screenshot call is timed. Do not add a readiness wait,
// override its timeout/options, retry it, or replace its original rejection.
export async function captureWithDiagnostic(page,options,records,{label,purpose='required',diagnosticOptions}={}) {
  const record={label,path:options.path,purpose,startedAt:new Date().toISOString(),status:'pending'};
  records.push(record);
  const started=performance.now();
  try {
    const result=await page.screenshot(options);
    record.captureElapsedMs=performance.now()-started;
    record.status='captured';
    return result;
  } catch(error) {
    record.captureElapsedMs=performance.now()-started;
    record.status='failed';
    record.error={name:error.name,message:error.message,stack:error.stack};
    const diagnosticStarted=performance.now();
    record.diagnostic=await collectScreenshotDiagnostic(page,diagnosticOptions);
    record.diagnosticElapsedMs=performance.now()-diagnosticStarted;
    throw error;
  }
}
