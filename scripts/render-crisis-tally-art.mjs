// Original code-native archival annotations, not physical damage diagrams.
import fs from 'node:fs/promises';
for(const status of ['loss','zero','unknown']){
 const unknown=status==='unknown';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72" shape-rendering="crispEdges" data-tally-state="${status}">
<title>Historical settlement annotation: ${status}</title><desc>Original paper-and-ink marker. Its shapes distinguish a recorded positive loss coefficient, a recorded zero, and unknown local details. It never represents a count of people, injuries, buildings or destroyed objects.</desc>
<g id="archive-page"><path d="M9 5h33l13 13v47H9Z" fill="${unknown?'#294944':'#D6C9A4'}" stroke="#718477" stroke-width="3" ${unknown?'stroke-dasharray="6 5"':''}/><path d="M42 5v14h13" fill="none" stroke="#718477" stroke-width="3"/></g>
${status==='loss'?'<g id="recorded-loss"><path d="M18 25h27M18 34h10M36 34h9M18 43h27" stroke="#294944" stroke-width="3"/><path d="M30 30l5 8" stroke="#9E8053" stroke-width="3"/><path d="M45 46l12 11-12 11-12-11Z" fill="#B4A06C" stroke="#294944" stroke-width="3"/></g>'
 :status==='zero'?'<g id="recorded-zero"><path d="M18 25h27M18 34h27M18 43h27" stroke="#294944" stroke-width="3"/><circle cx="45" cy="57" r="11" fill="#D6C9A4" stroke="#294944" stroke-width="3"/><circle cx="45" cy="57" r="5" fill="none" stroke="#294944" stroke-width="3"/></g>'
 :'<g id="unknown-detail"><path d="M18 25h8M36 25h9M18 34h8M36 34h9" stroke="#C0B38F" stroke-width="3"/><path d="M28 44v-5h13v10l-7 5v4M34 62v3" fill="none" stroke="#E0D6B7" stroke-width="4"/></g>'}
</svg>`;
 await fs.writeFile(`public/assets/crisis-tally-${status}.svg`,svg);
 console.log(`Original ${status} historical tally marker generated`);
}
