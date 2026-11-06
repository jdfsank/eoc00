// Historical-content regression suites explicitly open the new native reading
// controls before asserting their old text and links. Round20's own browser
// suite independently checks the closed-first reading order and navigation.
export async function readEndingDetails(page, {ledger=true, people=true, sources=true}={}) {
  if(!await page.locator('.ending').count())return;
  const selectors=[ledger?'details[data-ending-ledger]':null,people?'.character-epilogue details.ending-person-history':null,sources?'.character-epilogue details.ending-sources, [data-ending-interventions] details.ending-sources':null].filter(Boolean);
  for(const selector of selectors){
    const all=page.locator(selector);
    for(let i=0;i<await all.count();i++){const d=all.nth(i);if(!await d.evaluate(el=>el.open))await d.locator(':scope > summary').click();}
  }
}
