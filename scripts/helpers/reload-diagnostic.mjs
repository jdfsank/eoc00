import {performance} from 'node:perf_hooks';

// Evidence only: ordinary navigation can abort old asset requests. These events
// are deliberately separate from the suite's existing error/pass-fail policy.
export function observeReloadEvents(page,{maxEvents=120}={}) {
  const diagnostics={scope:'Read-only loading evidence. No retry, timeout override, readiness change or pass/fail substitution.',events:[],droppedEvents:0,operations:[]};
  const listeners=[];
  const add=(event,detail={})=>{
    diagnostics.events.push({at:new Date().toISOString(),event,...detail});
    if(diagnostics.events.length>maxEvents){diagnostics.events.shift();diagnostics.droppedEvents++;}
  };
  const listen=(target,event,read)=>{
    if(!target?.on)return;
    const handler=value=>{try{read(value);}catch{/* Diagnostics must not interrupt the test. */}};
    target.on(event,handler);listeners.push(()=>target.off(event,handler));
  };
  const text=value=>String(value??'').slice(0,2048);
  listen(page,'pageerror',error=>add('pageerror',{name:text(error.name),message:text(error.message)}));
  listen(page,'requestfailed',request=>add('requestfailed',{url:text(request.url()),resourceType:request.resourceType(),failure:request.failure()}));
  listen(page,'response',response=>{if(response.status()>=400)add('http-failure',{url:text(response.url()),status:response.status()});else if(response.request?.().isNavigationRequest())add('document-response',{url:text(response.url()),status:response.status()});});
  listen(page,'console',message=>{if(['error','warning'].includes(message.type())||/\[vite\].*(hot updated|page reload)/.test(message.text()))add('console',{type:message.type(),text:text(message.text()),location:message.location()});});
  for(const event of ['crash','close','domcontentloaded','load'])listen(page,event,()=>add(event));
  listen(page.context().browser(),'disconnected',()=>add('browser-disconnected'));
  return {diagnostics,dispose(){for(const remove of listeners)remove();}};
}

// One bounded, read-only snapshot after the original operation has rejected.
// A healthy DOM here does not prove it was healthy at the failure time.
export async function collectReloadDiagnostic(page,{timeoutMs=600}={}) {
  let timer;
  const unavailable=reason=>({status:'unavailable',reason});
  try {
    const observation=Promise.resolve().then(()=>page.evaluate(()=>{
      const app=document.querySelector('#app'),canvas=document.querySelector('canvas');
      const resources=performance.getEntriesByType('resource');
      return {status:'observed',url:location.href,readyState:document.readyState,visibility:document.visibilityState,
        hasAfterwave:!!window.afterwave,appChildCount:app?.childElementCount??null,
        styleCount:document.querySelectorAll('style,link[rel="stylesheet"]').length,
        bodyBackground:document.body?getComputedStyle(document.body).backgroundColor:null,
        canvasCount:document.querySelectorAll('canvas').length,canvasRect:canvas?.getBoundingClientRect().toJSON()??null,
        html:document.documentElement.outerHTML.slice(0,16000),htmlLimit:16000,
        resourceCount:resources.length,resources:resources.slice(-64).map(entry=>({name:entry.name.slice(0,2048),initiatorType:entry.initiatorType,duration:entry.duration,transferSize:entry.transferSize,responseStatus:entry.responseStatus})),resourceLimit:64};
    })).catch(error=>unavailable(`evaluation failed: ${error.message}`));
    return await Promise.race([observation,new Promise(resolve=>{timer=setTimeout(()=>resolve(unavailable(`host deadline ${timeoutMs}ms exceeded`)),timeoutMs)})]);
  } catch(error) {return unavailable(`collection failed: ${error.message}`);}
  finally {clearTimeout(timer);}
}

// Invoke the unchanged operation exactly once. Preserve its result or the very
// same rejection object. Successful reloads never trigger a DOM observation.
export async function reloadWithDiagnostic(page,operation,records,{label,context,diagnosticOptions}={}) {
  const record={label,context,startedAt:new Date().toISOString(),status:'pending'};
  records.push(record);
  const started=performance.now();
  try {
    const result=await operation();
    record.elapsedMs=performance.now()-started;record.status='completed';
    return result;
  } catch(error) {
    record.elapsedMs=performance.now()-started;record.status='failed';
    record.error={name:error?.name,message:error?.message??String(error),stack:error?.stack};
    const diagnosticStarted=performance.now();
    record.diagnostic=await collectReloadDiagnostic(page,diagnosticOptions);
    record.diagnosticElapsedMs=performance.now()-diagnosticStarted;
    throw error;
  }
}
