// Confirm a fresh import and coordinated save rather than waiting for the
// temporary success notification to disappear.
export async function importAndWaitForSave(page, file, {state,bigText}) {
  await page.evaluate(() => { window.__awPreviousImportToast=document.querySelector('.toast'); });
  await page.locator('#import-save').setInputFiles(file);
  await page.waitForFunction(() => {
    const toast=document.querySelector('.toast');
    return toast&&toast!==window.__awPreviousImportToast&&toast.textContent.startsWith('已导入。')&&window.afterwave.ui.screen==='world';
  });
  await page.locator('.selection-card').waitFor();
  await page.waitForFunction(({world,bigText}) => {
    const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1'),saved=raw&&JSON.parse(raw);
    return !a.storage.pending&&!a.storage.lastError&&!a.storage.conflicted&&saved&&
      JSON.stringify(saved.state)===world&&saved.ui.bigText===bigText&&a.ui.bigText===bigText;
  },{world:JSON.stringify(state),bigText});
}
