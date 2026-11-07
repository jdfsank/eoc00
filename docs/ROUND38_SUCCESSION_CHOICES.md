# Round 38 · Candidate 8/10 · Succession choice fork

## Scope

Adds a read-only comparison of the actual year-10 D4 protagonist contracts. No simulation, historical text, evidence, save migration, draft mutation, or new numerical rules are introduced. The main UI integration is separate from this model.

## Interface

`getSuccessionChoiceFork(state, cellId = 'D4', actorId = 'protagonist')` returns `null` outside the proven, editable window. Otherwise it returns a deeply frozen detached object:

- `title`, `summary`, `roleLabel`: short framing. The summary explicitly makes the branches conditional on the selected contract being fulfilled and distinguishes recruitment from companion deployment at year 20.
- `choices`: in `getActions` order, keyed by `actionId`.
- Each choice has `title`, short `travelling`, `local`, and `responsibility` text. The directory can use these instead of repeating full descriptions. `people` joins the first two as an alternate plain-text representation.
- Exact source `cost`, `probability`, `requireEvidence`, `description`, `risk`, `reward`, `modelNote`, `staffingNote`; `dueYear` is current year plus the source's `dueIn`.
- `missingEvidence` is a read-only difference from the public current investigation; it does not grant evidence, choose a draft, or imply sufficient resources.
- Recruitment `staffing` entries identify actual current roles and forward the hypothetical result of `getInstitutionStaffing`. These are conditional source-production factors, not net channel changes or a new forecast. `outputReducedNow` remains the helper's original hypothetical false; it must not be displayed as current loss.

No `available`, `affordable`, `selected`, or `ready` boolean is supplied. Action existence does not establish successful lock or commit. Original action cards and the existing review remain authoritative for requirements, budget, and submission.

## Narrative boundaries

- A failed construction leaves a real archive role, not a station to renew.
- With no existing role, voluntary recruitment creates neither a vacancy nor a successor.
- Renewal keeps Lin Che local; recruiting her and renewing are different uses of the same slot.
- Recruiting with succession requires actual consent evidence; a short comparison cannot claim that consent has already happened.
- Succession does not pay indefinite maintenance or renew the charter.
- Rebuilding uses a separate maintenance group and does not restore the original training chain.
- Contract completion at year 11 does not make the companion deployable before year 20.

## Sources and compatibility

- `src/succession-scene-context.js`: existing public provenance, permitted actor/location, year/phase, and known action-set gate. Unprovable original/pre-recruitment saves fall back to their original UI, without inferred posts.
- `src/simulation.js`: `getActions`, `getRecruitmentRoles`, `getInvestigation`, `getInstitutionStaffing`, and `RECRUITMENT_ACTIONS`. The model never copies the settlement engine or reads random seeds, rolls, saved prose, baselines, or future snapshots.
- Genuine producer fixtures: `tests/fixtures/pre-decision-flow-producer/simulation.js`, `pre-staffing-simulation.js`, `pre-recruitment-simulation.js`, and `legacy-simulation.js`. Untagged pre-staffing saves use the existing public compatibility rule; the model does not identify or migrate their original engine.

## Verification

`node --test tests/succession-choice-fork.test.js`

19 tests cover successful station, failed archive, no build, actual available action sets, exact cost/time/conditions, uncollected evidence, public budget shortage, original producers, current window boundaries, invalid source provenance, deeply frozen detached results, forbidden private/future reads, and all candidate contracts followed through year 40 without any display-induced settlement changes. The budget-shortage case is explicitly a public-value fixture, not represented as a natural historical producer route.

Files added:

- `src/succession-choice-fork.js`
- `tests/succession-choice-fork.test.js`
- `docs/ROUND38_SUCCESSION_CHOICES.md`

## Short risk and deployment revision

Recruitment travelling text now includes “第20年可部署林澈” directly; successor local text says “苏岚接班（需先商量）”. The risk responsibility line derives its station/archive label, half-production consequence, and conditional shutdown year from the already computed staffing entries. It says “若兑现” and only includes a shutdown year if the public staffing helper supplies one. A station-only policy archive explicitly does not incur vacancy production loss or shutdown. This additional explicit-policy fixture is not presented as a genuine old producer route; genuine original saves still fail closed to the original UI.
