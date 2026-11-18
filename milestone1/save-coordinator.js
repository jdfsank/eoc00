/** Raw-byte coordinator only. acquire(name, {signal}, callback) must provide an
 * exclusive cooperative lock. read/write must be synchronous. No UI or globals.
 * Timeout starts when a queued request begins acquiring, not at enqueue time.
 */
export function createSaveCoordinator({initialRaw, read, write, acquire,
  lockName = 'afterwave-save:afterwave.save.v1', timeoutMs = 8000,
  clock = {setTimeout:(...args)=>globalThis.setTimeout(...args), clearTimeout:id=>globalThis.clearTimeout(id)}}) {
  if (initialRaw !== null && typeof initialRaw !== 'string') throw new TypeError('initialRaw');
  if (typeof read !== 'function' || typeof write !== 'function') throw new TypeError('storage');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs');
  let expected = initialRaw, closed = false, conflicted = false, blocked = false;
  let lastError = null, active = null, queue = [], nextId = 0;
  const supported = typeof acquire === 'function';
  const unavailable = () => closed ? 'closed' : conflicted ? 'conflict' : blocked ? 'uncertain' : !supported ? 'unsupported' : null;
  const raw = () => { const value = read(); if (value !== null && typeof value !== 'string') throw new TypeError('read must return bytes'); return value; };
  function finish(job, result) {
    if (job.done) return;
    job.done = true;
    if (job.timer !== undefined) clock.clearTimeout(job.timer);
    if (active === job) active = null;
    lastError = result.ok ? null : result.reason;
    job.resolve({...result, id: job.id});
    pump();
  }
  function stopAll(reason) {
    const jobs = [...(active ? [active] : []), ...queue];
    active = null; queue = [];
    for (const job of jobs) {
      // Invalidate before abort: adapters may synchronously call the callback.
      if (job.done) continue;
      job.done = true;
      if (job.timer !== undefined) clock.clearTimeout(job.timer);
      job.controller?.abort();
      job.resolve({ok:false, reason, id:job.id});
    }
    lastError = reason;
  }
  function fault(reason) {
    if (reason === 'conflict') conflicted = true;
    else blocked = true;
    stopAll(reason);
  }
  function pump() {
    if (active || !queue.length) return;
    const reason = unavailable();
    if (reason) { stopAll(reason); return; }
    const job = active = queue.shift();
    job.controller = new AbortController();
    try { job.timer = clock.setTimeout(() => {
      if (job.done) return;
      // Invalidate before signal delivery and before allowing the next request.
      job.done = true; active = null;
      job.controller.abort(); lastError = 'timeout';
      job.resolve({ok:false, reason:'timeout', id:job.id}); pump();
    }, timeoutMs); } catch {
      // Initialization can fail before a lock is requested (e.g. timer receiver).
      // Invalidate even a partially registered timer and release active promptly.
      finish(job,{ok:false,reason:'timer-failed'}); return;
    }
    const commit = () => {
      if (job.done || active !== job || unavailable()) return;
      let current;
      try { current = raw(); } catch { finish(job,{ok:false,reason:'read-failed'}); return; }
      if (current !== expected) { fault('conflict'); return; }
      // Cooperative lock callback is synchronous from compare through readback.
      try { const result = write(job.value); if (result?.then) { fault('uncertain'); return; } }
      catch { // A throwing adapter might have changed disk before throwing.
        try { if (raw() !== expected) { fault('uncertain'); return; } }
        catch { fault('uncertain'); return; }
        finish(job,{ok:false,reason:'write-failed'}); return;
      }
      try { if (raw() !== job.value) { fault('uncertain'); return; } }
      catch { fault('uncertain'); return; }
      expected = job.value;
      finish(job,{ok:true});
    };
    try {
      Promise.resolve(acquire(lockName,{signal:job.controller.signal},commit)).then(() => {
        if (!job.done) finish(job,{ok:false,reason:'lock-no-callback'});
      }, () => { if (!job.done) finish(job,{ok:false,reason:'lock-failed'}); });
    } catch { if (!job.done) finish(job,{ok:false,reason:'lock-failed'}); }
  }
  return Object.freeze({
    save(value) {
      if (typeof value !== 'string') return Promise.resolve({ok:false,reason:'invalid-value'});
      const reason = unavailable();
      if (reason) return Promise.resolve({ok:false,reason});
      return new Promise(resolve => {queue.push({id:++nextId,value,resolve,done:false});pump();});
    },
    cancelPending() {stopAll('cancelled');},
    close() {if (!closed) {closed = true;stopAll('closed');}},
    observeExternal() {
      const reason = unavailable(); if (reason) return {ok:false,reason};
      let current; try { current = raw(); } catch {fault('uncertain');return {ok:false,reason:'uncertain'};}
      if (current !== expected) {fault('conflict');return {ok:false,reason:'conflict'};}
      return {ok:true};
    },
    snapshot() {return Object.freeze({supported,closed,conflicted,blocked,pending:queue.length+(active?1:0),lastError});}
  });
}
