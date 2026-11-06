# Causal trace record stages

`getRecordStageContext(state, record)` in `src/record-stage-context.js` is a pure, additive presentation helper. It returns `null` when public provenance is incomplete or inconsistent; otherwise it returns `{ kind, label, note }`.

- `submitted`: the source action was committed, not proof of success.
- `scheduled`: the contract's dated appointment, never an outcome claim.
- `success`, `failed`, `cancelled`: the actual resolved history entry.

Integrate only into causal trace cards. Keep their original title, text, year, identity, and historical category. A resolved event node still describes the scheduled checkpoint; its separate resolved history node supplies the result.

The helper validates unique history/event identities, canonical source-action identity, source window/date/cell, status, parent links, resolution date and result kind. Training and branch nodes require the genuine successful parent chains and established public dates. Future pending appointments can be shown, but future resolved outcomes, absent outcomes, duplicate identities, mismatched parents and unsupported descendants return null. Inputs copied by causal trace remain supported through equality of the public identity fields.

It reads only public own data fields in state.year/history/events; it never evaluates field accessors or reads prose, seeds, random rolls, probabilities, snapshots, institution state or simulation internals. It does not prove whole-save integrity or reconstruct missing historical contracts. Existing save validation remains responsible for save integrity. No simulation, persistence, schema or numerical changes.

Focused check: `node --test tests/record-stage-context.test.js`. Fixtures use existing current, original legacy and pre-future-check simulation producers without modifying fixture files. This check is not a browser or complete-suite certification.
