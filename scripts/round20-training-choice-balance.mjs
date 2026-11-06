// Run manually: node scripts/round20-training-choice-balance.mjs
// Kept outside the browser aggregate. This samples real player APIs, not a
// completed balance or human-playtest certification. Synthetic boundaries are
// labelled separately; old producer saves must continue byte-for-byte.
import fs from "node:fs/promises";
// Reproduce the published round-20 audit with its frozen, genuine producer.
// Current balance work runs round21-training-choice-balance.mjs instead.
import * as sim from "../tests/fixtures/pre-training-workload-producer/simulation.js";
import * as prior from "../tests/fixtures/pre-training-authorization-simulation.js";
import { restoreSave } from "../src/save.js";
const cp = structuredClone;
function lock(s, actor, cell, id, api = sim) {
  const a = api.getActions(s, cell, actor).find((a2) => a2.id === id);
  if (!a) throw Error(`unavailable ${id}`);
  for (const e of a.requireEvidence) if (!api.getInvestigation(s, actor, cell).evidence.includes(e)) api.investigate(s, actor, cell, e);
  api.lockTask(s, actor, cell, id);
}
function commit(s, api = sim) {
  for (const a of api.getActors(s)) if (!s.drafts[a.id]) api.passTask(s, a.id);
  api.commitWindow(s);
}
function next(s, api = sim) {
  commit(s, api);
  api.advanceToNextWindow(s);
}
const chan = (s, c = "E4") => cp(s.cells.find((x) => x.id === c).channels);
const scenarios = { review_warning: [["protagonist", "B4", "independent_review"], ["linche", "D4", "free_warning"]], review_respect: [["protagonist", "B4", "independent_review"], ["linche", "D4", "present_archive"]], review_refusal: [["linche", "B4", "independent_review"], ["protagonist", "D4", "relocate_teacher"]], review_only: [["protagonist", "B4", "independent_review"]], warning_only: [["linche", "D4", "free_warning"]], all_pass: [], prior_school: [["protagonist", "E4", "train_network"], ["linche", "D4", "free_warning"]], veto_aid: [["protagonist", "F6", "local_veto"], ["linche", "D5", "mutual_aid"]] };
const data = { scope: "Deterministic natural-route audit, not completed balance validation or human playtesting. Synthetic boundaries are labelled and are not natural affordability evidence.", balanced: false, seeds: "0-19", natural: [], buildFailures: [], boundary: [], legacy: [], povertyNatural: [], unavailable: [] };
function endPair(s, partner = ["protagonist", "D4", "share_power"]) {
  const outputs = {};
  for (const id of ["authorize_training", "train_network"]) {
    const t2 = cp(s);
    lock(t2, "linche", "E4", id);
    if (partner) lock(t2, ...partner);
    commit(t2);
    const years = { 30: chan(t2) };
    while (t2.phase === "playback") {
      sim.advanceYear(t2);
      years[t2.year] = chan(t2);
    }
    const e = sim.getEnding(t2);
    outputs[id] = { channels: chan(t2), years, title: e.title, metrics: e.metrics, readiness: { staffCells: e.handoff.staffCells, authorizedCells: e.handoff.authorizedCells, checkCells: e.handoff.checkCells, canShare: e.handoff.canShare, canWithdraw: e.handoff.canWithdraw }, crisis: cp(t2.flags.crisis), coverage: Object.fromEntries(["D4", "E4", "D5", "F6"].map((c) => [c, sim.getWarningCoverage(t2)[c].coverage])), valid: sim.validateState(t2).valid };
  }
  const a = outputs.authorize_training, t = outputs.train_network;
  return { at30: chan(s), authorization: a, training: t, delta: Object.fromEntries(sim.CHANNELS.map((k) => [k, +(t.channels[k] - a.channels[k]).toFixed(4)])), sameTitle: a.title === t.title, sameCrisis: JSON.stringify(a.crisis) === JSON.stringify(t.crisis), sameCoverage: JSON.stringify(a.coverage) === JSON.stringify(t.coverage), sameReadiness: JSON.stringify(a.readiness) === JSON.stringify(t.readiness) };
}
let representative;
for (let seed = 0; seed < 20; seed++) for (const build of ["build_joint", "build_state", "build_merchant"]) {
  const a = sim.createRun(seed);
  lock(a, "protagonist", "D4", build);
  next(a);
  if (!a.flags.stationBuilt) {
    data.buildFailures.push({ seed, build, training: a.institutions.filter((i) => i.kind === "training").length });
    continue;
  }
  for (const recruitment of ["recruit_successor", "recruit_risk"]) {
    const b = cp(a);
    lock(b, "protagonist", "D4", recruitment);
    next(b);
    for (const [scenario, choices] of Object.entries(scenarios)) {
      const s = cp(b);
      for (const choice of choices) lock(s, ...choice);
      next(s);
      if (!sim.getTrainingAuthorizationPlan(s).available) {
        data.unavailable.push({ seed, build, recruitment, scenario, reason: sim.getTrainingAuthorizationPlan(s).reason });
        continue;
      }
      const row = { seed, build, recruitment, scenario, review: s.events.find((e) => e.actionId === "independent_review")?.status ?? null, ...endPair(s) };
      data.natural.push(row);
      if (seed === 0 && build === "build_joint" && recruitment === "recruit_successor" && scenario === "review_warning") representative = cp(s);
    }
  }
}
for (const [name, channels, change] of [
  ["economy_only_authorization", { economy: 2, science: 2, politics: 3 }],
  ["science_only_authorization", { economy: 4, science: 1, politics: 3 }],
  ["politics_only_training", { economy: 4, science: 2, politics: 2 }],
  ["both_exact", { economy: 4, science: 2, politics: 3 }],
  ["neither", { economy: 1, science: 1, politics: 1 }],
  ["target_inactive", {}, (s) => s.institutions.find((i) => i.kind === "training" && i.cellId === "E4").active = false],
  ["target_zero_maintenance", {}, (s) => s.institutions.find((i) => i.kind === "training" && i.cellId === "E4").maintenance = 0],
  ["source_missing", {}, (s) => s.events = s.events.filter((e) => e.actionId !== "training")]
]) {
  const s = cp(representative);
  Object.assign(s.cells.find((c) => c.id === "E4").channels, channels);
  change?.(s);
  const results = {};
  for (const id of ["authorize_training", "train_network"]) {
    const t = cp(s), available = sim.getActions(t, "E4", "linche").some((a) => a.id === id);
    let error = null, committed = false, atomic = null;
    try {
      lock(t, "linche", "E4", id);
      sim.passTask(t, "protagonist");
      const before = JSON.stringify(t);
      try {
        sim.commitWindow(t);
        committed = true;
      } catch (e) {
        atomic = before === JSON.stringify(t);
        throw e;
      }
    } catch (e) {
      error = e.message;
    }
    results[id] = { available, committed, error, atomic };
  }
  data.boundary.push({ name, synthetic: true, validBefore: sim.validateState(s).valid, ...results });
}
for (const [seed, build] of [[0, "build_joint"], [0, "build_state"], [1, "build_merchant"]]) for (const at10 of [null, ["E4", "fund_school"], ["D5", "mutual_aid"]]) for (const at20 of [null, ["E4", "train_network"]]) {
  const s = sim.createRun(seed);
  lock(s, "protagonist", "D4", build);
  next(s);
  if (at10) lock(s, "protagonist", ...at10);
  next(s);
  if (at20) lock(s, "protagonist", ...at20);
  next(s);
  data.povertyNatural.push({ seed, build, at10, at20, at30: chan(s), damage: s.flags.crisis.damage, actions: sim.getActions(s, "E4").map((a) => a.id) });
}
for (const phase of ["planning", "locked", "committed", "ended"]) {
  const s = prior.createRun(0);
  lock(s, "protagonist", "D4", "build_joint", prior);
  next(s, prior);
  lock(s, "protagonist", "D4", "recruit_successor", prior);
  next(s, prior);
  lock(s, "protagonist", "B4", "independent_review", prior);
  lock(s, "linche", "D4", "free_warning", prior);
  next(s, prior);
  if (phase !== "planning") {
    lock(s, "protagonist", "D4", "share_power", prior);
    lock(s, "linche", "E4", "train_network", prior);
  }
  if (["committed", "ended"].includes(phase)) prior.commitWindow(s);
  if (phase === "ended") prior.advanceToNextWindow(s);
  const t = restoreSave({ state: cp(s) }).state;
  const identicalOnRestore = JSON.stringify(t) === JSON.stringify(s);
  if (phase === "planning") {
    lock(s, "protagonist", "D4", "share_power", prior);
    lock(s, "linche", "E4", "train_network", prior);
    lock(t, "protagonist", "D4", "share_power");
    lock(t, "linche", "E4", "train_network");
  }
  if (["planning", "locked"].includes(phase)) {
    prior.commitWindow(s);
    sim.commitWindow(t);
  }
  if (phase !== "ended") {
    prior.advanceToNextWindow(s);
    sim.advanceToNextWindow(t);
  }
  data.legacy.push({ phase, identicalOnRestore, identicalAfter: JSON.stringify(t) === JSON.stringify(s), version: t.trainingAuthorizationRulesVersion ?? null });
}
const rows = data.natural;
const summary = {
  scope: data.scope,
  balanced: false,
  seeds: data.seeds,
  pairs: rows.length,
  failedBuilds: data.buildFailures.length,
  unavailable: data.unavailable.length,
  allGreater: rows.every((row) => Object.values(row.delta).every((value) => value > 0)),
  sameTitles: rows.filter((row) => row.sameTitle).length,
  sameCoverage: rows.filter((row) => row.sameCoverage).length,
  sameCrisis: rows.filter((row) => row.sameCrisis).length,
  sameReadiness: rows.filter((row) => row.sameReadiness).length,
  allValid: rows.every((row) => row.authorization.valid && row.training.valid),
  ranges: Object.fromEntries(sim.CHANNELS.map((key) => [key, {
    min: Math.min(...rows.map((row) => row.delta[key])),
    max: Math.max(...rows.map((row) => row.delta[key]))
  }])),
  at30Minimum: Object.fromEntries(sim.CHANNELS.map((key) => [
    key,
    Math.min(...[...rows, ...data.povertyNatural].map((row) => row.at30[key]))
  ])),
  reviewFailures: rows.filter((row) => row.review === "failed").length,
  titles: [...new Set(rows.map((row) => row.authorization.title))],
  boundary: data.boundary,
  legacy: data.legacy
};
const directory = new URL("../playtest-output/", import.meta.url);
const output = new URL("round20-training-choice-balance-results.json", directory);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(output, JSON.stringify({ summary, ...data }, null, 2));
console.log(JSON.stringify({ ...summary, output: output.pathname }, null, 2));
if (!summary.allValid || !summary.legacy.every((row) => row.identicalOnRestore && row.identicalAfter)) process.exitCode = 1;
