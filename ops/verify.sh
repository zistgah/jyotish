#!/usr/bin/env bash
# Jyotish gate. Exit 0: every check passed. Exit 1: refused. Exit 3: cannot judge (a tool is missing).
# Writes nothing, anywhere. SPDX-License-Identifier: GPL-3.0-or-later. (c) 1993-2026 Abhishek Choudhary. AyeAI.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
fail=0; skipped=()
say() { printf '%s\n' "$*"; }
run() {
  local name="$1"; shift; local out
  if out=$("$@" 2>&1); then say "  ok   $name"; else say "  FAIL $name"; printf '%s\n' "$out" | tail -25 | sed 's/^/       /'; fail=1; fi
}
command -v node >/dev/null 2>&1 || { say "cannot judge: node is not installed"; exit 3; }
command -v python3 >/dev/null 2>&1 || { say "cannot judge: python3 is not installed"; exit 3; }
say "Jyotish gate"
run "engine, calendar, kundali, matching and configuration suite" node tests/run.js
if node -e 'require("jsdom")' >/dev/null 2>&1; then run "headless interface run" node tests/ui-smoke.js
else skipped+=("headless interface run: jsdom is not installed, so the interface was not exercised"); fi
run "config/bundle.js equals config/*.json" python3 tools/build_config.py --check
run "every JSON file parses" node -e '
  const fs=require("fs"),p=require("path");const L=["misty.json","seed.json","roadmap.json","manifest.webmanifest","vendor/MANIFEST.json"];
  for(const d of ["config","dhancha"]) for(const f of fs.readdirSync(d)) if(f.endsWith(".json")) L.push(p.join(d,f));
  for(const f of L) JSON.parse(fs.readFileSync(f,"utf8"));'
# seal, receipt and deposit material written by the estate tooling is not the authored tree and is not judged here
X_DIRS=(--exclude-dir=.git --exclude-dir=attest --exclude-dir=receipts --exclude-dir=provenance --exclude-dir=doi-package)
run "no build artefacts in the authored tree" bash -c '! find . \( -path ./.git -o -path ./attest -o -path ./receipts -o -path ./provenance -o -path ./doi-package \) -prune -o \( -name __pycache__ -o -name "*.pyc" -o -name "*.tar.gz" -o -name node_modules \) -print | grep -q .'
run "no machine-local path in any authored text file" bash -c '! grep -rIlE "(/home/[a-z]|/Users/[A-Za-z]|/tmp/)" "$@" --exclude="MANIFEST*" --exclude=verify.sh . | grep -q .' _ "${X_DIRS[@]}"
run "every page script and cached file exists" node -e '
  const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const s=[...h.matchAll(/src="([^"]+)"/g)].map(m=>m[1]);
  const w=fs.readFileSync("sw.js","utf8");const c=JSON.parse(w.match(/FILES = (\[[\s\S]*?\]);/)[1].replace(/\x27/g,"\""));
  const miss=s.concat(c.filter(x=>x!=="./")).filter(f=>!fs.existsSync(f)); if(miss.length){console.log("missing: "+miss.join(", "));process.exit(1);}'
run "copyright on the page, the README and every engine file" bash -c 'grep -q "Abhishek Choudhary. All rights reserved" index.html && grep -q "Abhishek Choudhary. All rights reserved" README.md && for f in lib/*.js app/*.js; do grep -q "1993-2026 Abhishek Choudhary" "$f" || { echo "no copyright: $f"; exit 1; }; done'
run "no placeholder DOI" bash -c '! grep -rIlE "zenodo\.(X+|0{6,}|[0-9]*N{3,})|DOI-PENDING" "$@" --exclude=verify.sh . | grep -q .' _ "${X_DIRS[@]}"
run "shell scripts parse" bash -c 'for f in $(find . -name "*.sh" -not -path "./.git/*"); do bash -n "$f" || exit 1; done'
for s in "${skipped[@]+"${skipped[@]}"}"; do say "  SKIP $s"; done
if [ "$fail" -ne 0 ]; then say "REFUSED: the tree does not pass its own gate"; exit 1; fi
say "PASSED${skipped[*]:+, with ${#skipped[@]} check skipped and named above}"
