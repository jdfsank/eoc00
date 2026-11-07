import {getDecadeReview} from './decade-review.js';
import {getStageBoundaryContext} from './stage-boundary-context.js';

const PASS_RESPONSIBILITY = '放弃一个名额没有替地方解除责任，下一次介入仍需面对留下的问题。';
const FINAL_PASS_RESPONSIBILITY = '本阶段的介入已经结束，放弃一个名额没有替地方解除责任；留下的问题仍在这段历史里。';

// Adapt current reading copy only after the original provenance-aware view has
// recognized an explicit pass. Historical producers and their text stay intact.
export function getStageDecadeReview(state) {
  const view = getDecadeReview(state);
  if (!view || !getStageBoundaryContext(state)?.terminal) return view;
  return {...view, cards: view.cards.map(card => {
    if (!card.sourceIds.includes(`pass:30:${card.actorId}`)
      || !card.responsibility.startsWith(PASS_RESPONSIBILITY)) return card;
    return {...card, responsibility: FINAL_PASS_RESPONSIBILITY + card.responsibility.slice(PASS_RESPONSIBILITY.length)};
  })};
}
