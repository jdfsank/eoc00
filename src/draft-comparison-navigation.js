// Reading only. Keep location/history, draft identity and every contract intact.
// The caller owns repeated-pointer protection already used by other page jumps.
export function navigateDraftComparison(link) {
 const details=link?.closest?.('[data-draft-choice-comparison]');
 const section=link?.dataset?.draftComparisonLink;
 if(!details?.open||!['cost','time','reward','risk','responsibility','index','close'].includes(section))return null;
 const selector=section==='close'?':scope > summary':section==='index'?'#draft-comparison-index':`#draft-comparison-${section}`;
 const target=details.querySelector(selector);
 if(!target)return null;
 if(section==='close')details.open=false;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'start',behavior:'instant'});
 return target;
}
