// Existing deep-contract regressions explicitly read the disclosures introduced
// in round 22. The new round-22 browser tests separately verify the default,
// collapsed decision path and its always-visible material risks.
import assert from 'node:assert/strict';
export async function readDecisionDetails(page) {
  const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));
  const selector='details[data-confirm-contract-details], details[data-task-contract-details], details[data-window-outlook-details]';
  for(const detail of await page.locator(selector).all()) {
    if(!await detail.evaluate(e=>e.open))await detail.locator(':scope > summary').click();
    assert.equal(await detail.evaluate(e=>e.open),true,'Decision disclosure opens through its real summary');
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.afterwave.state)),before,'Reading the complete contract leaves the entire world unchanged');
}
