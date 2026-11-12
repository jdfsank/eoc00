#!/bin/bash
set -u
cd "$(dirname "$0")/../.." || exit 1
OUT="${AW_VALIDATION_OUTPUT:-$(pwd)/validation-round49}"
mkdir -p "$OUT"
python3 - "$OUT" <<'PY'
from pathlib import Path
import sys,json,time,hashlib
out=Path(sys.argv[1]);root=Path('.');paths=[]
assert not (out/'freeze.json').exists(),'Preserve previous run before starting a fresh validation directory'
for d in ['src','tests','scripts','public','.github']:paths.extend(str(p) for p in (root/d).rglob('*') if p.is_file())
paths+=['index.html','package.json','package-lock.json','vite.config.js']
(out/'freeze.json').write_text(json.dumps({'startedAt':time.time(),'hashes':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sorted(paths)}},indent=2)+'\n')
PY
[ "$?" = 0 ] || exit 1
run_stage(){
 name="$1";shift
 date +%s.%N > "$OUT/$name.started"
 printf '%s\n' "$*" > "$OUT/$name.command"
 "$@" > "$OUT/$name.log" 2>&1
 code=$?
 printf '%s\n' "$code" > "$OUT/$name.exit"
 date +%s.%N > "$OUT/$name.finished"
 printf '%s exit=%s\n' "$name" "$code"
 if [ "$code" != 0 ]; then tail -80 "$OUT/$name.log";exit "$code";fi
}
run_stage unit npm test
run_stage build npm run build
run_stage browser npm run test:browser
run_stage teaching npm run test:teaching-timing
run_stage matrix npm run test:outlook-matrix
run_stage tradeoffs node scripts/round21-training-choice-balance.mjs
run_stage roles node scripts/round22-role-opportunity-audit.mjs
