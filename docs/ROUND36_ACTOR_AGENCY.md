# Round 36: put the executor's boundary beside the choice

## Observed problem

Candidate 5 already gives Linche a concrete refusal in the year-20 D4 scene. `getActorRefusals` supplies her reason and any existing recruitment source; `getActions` removes forced relocation from her own available actions. The protagonist's choices are separate.

However, the scene's “先看方案 · 免费” control jumps below that refusal. In a local Chromium audit at 390 × 844, using seed 0, no year-0 intervention, year-10 voluntary recruitment and Linche at D4 in year 20, the refusal occupied viewport y = −299.58 to −13.59 after the jump. The choices section began at y = 12.41. Its directory listed two available actions, research balance and the one-action limit, but no explanation of the missing relocation option. This was a discoverability problem, not a missing simulation rule.

## Change

`actor-agency-view.js` renders a compact “执行者的立场” notice between the choices heading and contract directory. It repeats the existing refusal title, states that further investigation will not remove this executor restriction, and clarifies that Linche's position does not decide for the protagonist. “回读完整理由” moves to the original refusal heading. A return control moves back to the compact notice.

The original full reason and source control remain in the scene. This keeps Linche's existing words and motives accessible without duplicating the full paragraph or adding a disabled, fictional contract. The notice has a left border, differentiated background, wrapping text, visible focus outline and minimum 48px-high controls. Its headings are programmatic focus destinations, not additional tab stops.

## Historical and narrative boundaries

- The view consumes an existing refusal; it creates no refusal rule, consent, promise, evidence or outcome.
- Exactly one supported `relocate_teacher` refusal with a nonempty title and reason is required. Empty or ambiguous input produces no compact notice.
- The title is escaped. The summary does not read or infer a recruitment year, personal promise or job from current institution flags.
- The link says “回读完整理由”, not “已存来源”: a missing-source refusal does not imply that an old promise has been verified.
- The existing model controls older saves. A pre-refusal-rule save is not retroactively given this restriction. A current refusal with incomplete provenance retains its existing explicit uncertainty.
- `simulation.js` and `story.js` matched the immutable round-36 baseline during this review. Contract, event and historical wording were not changed by this feature.

## Scope

This is a local scene-reading improvement, not a new narrative branch or a balance change. It makes an existing character decision understandable where the player chooses work. It does not claim to resolve other old-save provenance issues or replace the complete source record.
