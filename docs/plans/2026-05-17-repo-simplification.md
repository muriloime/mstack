# Repo Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip gstack down to its core novel skills, removing telemetry/data-collection, update logic, and unused skill directories while keeping infrastructure that the surviving skills depend on.

**Architecture:** Delete directories wholesale, then surgically remove telemetry/update-check code from the preamble generator and the `setup` script. The test suite will need corresponding deletions. The `gen:skill-docs` pipeline and the `setup` script are the two main "wiring" files to clean up.

**Tech Stack:** Bun, TypeScript, bash scripts, SKILL.md templates.

---

## What to KEEP

Skills:

- `office-hours/`
- `plan-ceo-review/`
- `plan-eng-review/`
- `plan-design-review/`
- `design-consultation/`
- `design-review/`
- `design-shotgun/`
- `design-html/`
- `investigate/`
- `autoplan/`
- `review/`
- `cso/`
- `guard/`
- `retro/`
- `qa/`
- `scrape/`
- `document-generate/`
- `document-release/`
- `landing-report/`
- `plan-tune/` ← kept per user

Infrastructure / non-skills:

- `bin/` — keep only bins needed by surviving skills (see Task 6)
- `scripts/` — keep build/gen scripts, remove analytics.ts, telemetry resolvers
- `lib/`
- `hosts/`
- `test/` — keep tests for surviving skills, delete rest
- `agents/`
- `browse/` — underlying browser infra (used by qa/scrape)
- `design/` — design binary
- `docs/`
- `CLAUDE.md`, `ETHOS.md`, `CHANGELOG.md`, `VERSION`, `package.json`, `setup`, etc.
- `openclaw/` (kept)
- `contrib/`

---

## What to DELETE

Skill directories:

- `benchmark/`
- `benchmark-models/`
- `canary/`
- `pair-agent/`
- `freeze/`
- `unfreeze/`
- `land-and-deploy/`
- `ship/` ← removed (user kept autoplan+review only)
- `codex/`
- `careful/`
- `learn/`
- `context-save/`
- `context-restore/`
- `skillify/`
- `devex-review/`
- `plan-devex-review/`
- `extension/` (Chrome extension)
- `setup-gbrain/`
- `sync-gbrain/`
- `open-gstack-browser/`
- `connect-chrome` (symlink)
- `setup-browser-cookies/`
- `setup-deploy/`
- `gstack-upgrade/`
- `health/`
- `model-overlays/`
- `supabase/`
- `browser-skills/`
- `make-pdf/`
- `qa-only/`

Data-collection bin scripts (in `bin/`):

- `gstack-telemetry-log`
- `gstack-telemetry-sync`
- `gstack-update-check`
- `gstack-session-update`
- `gstack-analytics`
- `gstack-timeline-log`
- `gstack-timeline-read`
- `gstack-question-log`
- `gstack-question-preference`
- `gstack-review-log`
- `gstack-review-read`
- `gstack-learnings-log`
- `gstack-learnings-search`
- `gstack-specialist-stats`
- `gstack-taste-update`
- `gstack-builder-profile`
- `gstack-developer-profile`
- `gstack-community-dashboard`
- `gstack-artifacts-init`
- `gstack-artifacts-url`
- `gstack-brain-consumer`
- `gstack-brain-enqueue`
- `gstack-brain-reader` (symlink)
- `gstack-brain-restore`
- `gstack-brain-sync`
- `gstack-brain-uninstall`
- `gstack-gbrain-supabase-provision`
- `gstack-gbrain-supabase-verify`
- `gstack-gbrain-mcp-verify`
- `gstack-gbrain-repo-policy`
- `gstack-gbrain-source-wireup`
- `gstack-gbrain-detect`
- `gstack-gbrain-install`
- `gstack-gbrain-lib.sh`
- `gstack-gbrain-sync.ts`
- `gstack-memory-ingest.ts`
- `gstack-brain-context-load.ts`
- `gstack-gbrain-sync.ts`
- `gstack-codex-probe`
- `gstack-extension`
- `gstack-settings-hook`
- `gstack-team-init`
- `gstack-model-benchmark`
- `gstack-uninstall` ← keep this one (useful)

Scripts to delete from `scripts/`:

- `analytics.ts`
- `garry-output-comparison.ts`
- `psychographic-signals.ts`
- `question-registry.ts`
- `update-readme-throughput.ts`
- `task-emission-schema.ts`
- `archetypes.ts`
- `build-app.sh`

Resolver scripts to simplify (in `scripts/resolvers/`):

- `scripts/resolvers/learnings.ts` — delete
- `scripts/resolvers/make-pdf.ts` — delete
- `scripts/resolvers/gbrain.ts` — delete
- `scripts/resolvers/codex-helpers.ts` — delete
- `scripts/resolvers/preamble/generate-preamble-bash.ts` — strip telemetry, update-check, learnings, timeline, gbrain sections (see Task 4)
- `scripts/resolvers/preamble/generate-completion-status.ts` — strip telemetry section (see Task 4)

Test files to delete (for removed features):

- `test/analytics.test.ts`
- `test/telemetry.test.ts`
- `test/timeline.test.ts`
- `test/team-mode.test.ts`
- `test/taste-engine.test.ts`
- `test/builder-profile.test.ts`
- `test/brain-sync.test.ts`
- `test/gbrain-*.test.ts` (all gbrain tests)
- `test/gstack-brain-*.test.ts`
- `test/gstack-gbrain-*.test.ts`
- `test/gstack-developer-profile.test.ts`
- `test/gstack-artifacts-*.test.ts`
- `test/artifacts-init-migration.test.ts`
- `test/benchmark-*.test.ts`
- `test/codex-e2e*.test.ts`
- `test/codex-hardening.test.ts`
- `test/codex-resume-flag-semantics.test.ts`
- `test/context-save-hardening.test.ts`
- `test/skill-e2e-setup-gbrain*.test.ts`
- `test/skill-e2e-skillify.test.ts`
- `test/skill-e2e-sidebar.test.ts`
- `test/skill-e2e-session-intelligence.test.ts`
- `test/skill-e2e-plan-devex*.test.ts`
- `test/skill-e2e-ship-idempotency.test.ts`
- `test/upgrade-migration-v1.test.ts`
- `test/uninstall.test.ts`
- `test/v0-dormancy.test.ts`
- `test/explain-level-config.test.ts` (only if it exclusively tests telemetry configs)
- `test/gemini-e2e.test.ts`

---

## Task 1: Delete removed skill directories

**Files:**

- Delete: `benchmark/`, `benchmark-models/`, `canary/`, `pair-agent/`, `freeze/`, `unfreeze/`
- Delete: `land-and-deploy/`, `ship/`, `codex/`, `careful/`, `learn/`
- Delete: `context-save/`, `context-restore/`, `skillify/`, `devex-review/`, `plan-devex-review/`
- Delete: `extension/`, `setup-gbrain/`, `sync-gbrain/`, `open-gstack-browser/`
- Delete: `setup-browser-cookies/`, `setup-deploy/`, `gstack-upgrade/`, `health/`
- Delete: `model-overlays/`, `supabase/`, `browser-skills/`, `make-pdf/`, `qa-only/`
- Delete: `connect-chrome` (symlink)

**Step 1: Verify the list before deleting**

```bash
ls /home/murilo/code/zzug/mstack/ | sort
```

Expected: all directories above are present.

**Step 2: Delete skill directories**

```bash
cd /home/murilo/code/zzug/mstack
rm -rf benchmark benchmark-models canary pair-agent freeze unfreeze
rm -rf land-and-deploy ship codex careful learn
rm -rf context-save context-restore skillify devex-review plan-devex-review
rm -rf extension setup-gbrain sync-gbrain open-gstack-browser
rm -rf setup-browser-cookies setup-deploy gstack-upgrade health
rm -rf model-overlays supabase browser-skills make-pdf qa-only
rm -f connect-chrome
```

**Step 3: Verify deletions**

```bash
ls /home/murilo/code/zzug/mstack/ | sort
```

None of the deleted names should appear.

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove unused skill directories (browser, pdf, telemetry-adjacent, deploy tools)"
```

---

## Task 2: Delete data-collection bin scripts

**Files:**

- Modify: `bin/` — delete ~35 telemetry/data/gbrain/update bins

**Step 1: List candidates**

```bash
ls /home/murilo/code/zzug/mstack/bin/ | sort
```

**Step 2: Delete telemetry and data-collection bins**

```bash
cd /home/murilo/code/zzug/mstack/bin
rm -f gstack-telemetry-log gstack-telemetry-sync
rm -f gstack-update-check gstack-session-update
rm -f gstack-analytics
rm -f gstack-timeline-log gstack-timeline-read
rm -f gstack-question-log gstack-question-preference
rm -f gstack-review-log gstack-review-read
rm -f gstack-learnings-log gstack-learnings-search
rm -f gstack-specialist-stats
rm -f gstack-taste-update
rm -f gstack-builder-profile gstack-developer-profile
rm -f gstack-community-dashboard
rm -f gstack-artifacts-init gstack-artifacts-url
rm -f gstack-brain-consumer gstack-brain-enqueue
rm -f gstack-brain-reader gstack-brain-restore gstack-brain-sync gstack-brain-uninstall
rm -f gstack-gbrain-supabase-provision gstack-gbrain-supabase-verify
rm -f gstack-gbrain-mcp-verify gstack-gbrain-repo-policy
rm -f gstack-gbrain-source-wireup gstack-gbrain-detect gstack-gbrain-install
rm -f gstack-gbrain-lib.sh
rm -f gstack-gbrain-sync.ts gstack-memory-ingest.ts gstack-brain-context-load.ts
rm -f gstack-codex-probe
rm -f gstack-extension gstack-settings-hook gstack-team-init
rm -f gstack-model-benchmark
```

**Step 3: Also delete the TypeScript source scripts**

```bash
cd /home/murilo/code/zzug/mstack/scripts
rm -f analytics.ts garry-output-comparison.ts psychographic-signals.ts
rm -f question-registry.ts update-readme-throughput.ts
rm -f task-emission-schema.ts archetypes.ts build-app.sh
```

**Step 4: Delete gbrain and pdf resolver modules**

```bash
cd /home/murilo/code/zzug/mstack/scripts/resolvers
rm -f learnings.ts make-pdf.ts gbrain.ts codex-helpers.ts
```

**Step 5: Verify bin still has the essentials**

```bash
ls /home/murilo/code/zzug/mstack/bin/ | sort
```

Expected survivors: `gstack-config`, `gstack-paths`, `gstack-slug`, `gstack-repo-mode`, `gstack-platform-detect`, `gstack-diff-scope`, `gstack-next-version`, `gstack-open-url`, `gstack-relink`, `gstack-patch-names`, `gstack-global-discover`, `gstack-global-discover.ts`, `dev-setup`, `dev-teardown`, `chrome-cdp`, and others used by surviving skills.

**Step 6: Commit**

```bash
git add -u
git commit -m "chore: delete telemetry, update-check, and data-collection bin scripts and resolver modules"
```

---

## Task 3: Delete test files for removed features

**Files:**

- Delete: numerous test files under `test/`

**Step 1: Delete tests for removed skills/features**

```bash
cd /home/murilo/code/zzug/mstack/test
rm -f analytics.test.ts telemetry.test.ts timeline.test.ts
rm -f team-mode.test.ts taste-engine.test.ts builder-profile.test.ts
rm -f brain-sync.test.ts
rm -f gbrain-detect-install.test.ts gbrain-detect-shape.test.ts
rm -f gbrain-init-rollback.test.ts gbrain-lib-verify.test.ts
rm -f gbrain-local-status.test.ts gbrain-repo-policy.test.ts
rm -f gbrain-sources.test.ts gbrain-supabase-provision.test.ts
rm -f gbrain-sync-skip.test.ts
rm -f gstack-brain-context-load.test.ts
rm -f gstack-developer-profile.test.ts
rm -f gstack-gbrain-detect-mcp-mode.test.ts gstack-gbrain-mcp-verify.test.ts
rm -f gstack-gbrain-source-wireup.test.ts gstack-gbrain-sync.test.ts
rm -f gstack-artifacts-init.test.ts gstack-artifacts-url.test.ts
rm -f artifacts-init-migration.test.ts
rm -f benchmark-cli.test.ts benchmark-runner.test.ts
rm -f codex-e2e-plan-format.test.ts codex-e2e.test.ts
rm -f codex-hardening.test.ts codex-resume-flag-semantics.test.ts
rm -f context-save-hardening.test.ts
rm -f gemini-e2e.test.ts
rm -f skill-e2e-setup-gbrain-bad-token.test.ts
rm -f skill-e2e-setup-gbrain-path4-local-pglite.test.ts
rm -f skill-e2e-setup-gbrain-remote.test.ts
rm -f skill-e2e-skillify.test.ts
rm -f skill-e2e-sidebar.test.ts
rm -f skill-e2e-session-intelligence.test.ts
rm -f skill-e2e-plan-devex-finding-count.test.ts
rm -f skill-e2e-plan-devex-finding-floor.test.ts
rm -f skill-e2e-plan-devex-plan-mode.test.ts
rm -f skill-e2e-ship-idempotency.test.ts
rm -f upgrade-migration-v1.test.ts
rm -f uninstall.test.ts v0-dormancy.test.ts
```

**Step 2: Run remaining free tests to verify nothing breaks**

```bash
cd /home/murilo/code/zzug/mstack && bun test browse/test/ test/ --ignore 'test/skill-e2e-*.test.ts' --ignore test/skill-llm-eval.test.ts --ignore test/skill-routing-e2e.test.ts --ignore test/codex-e2e.test.ts --ignore test/gemini-e2e.test.ts 2>&1 | tail -30
```

Some failures are expected at this stage (telemetry resolver still references deleted modules). That's OK — we fix it in Task 4.

**Step 3: Commit**

```bash
git add -u
git commit -m "chore: delete tests for removed skills and data-collection features"
```

---

## Task 4: Strip telemetry + update-check from preamble generators

The two key files are:

- `scripts/resolvers/preamble/generate-preamble-bash.ts` — generates the `## Preamble (run first)` bash block in every SKILL.md
- `scripts/resolvers/preamble/generate-completion-status.ts` — generates the completion bash block

**Files:**

- Modify: `scripts/resolvers/preamble/generate-preamble-bash.ts`
- Modify: `scripts/resolvers/preamble/generate-completion-status.ts`
- Modify: `scripts/resolvers/preamble.ts` — update any imports/refs to deleted resolvers

**Step 1: Read the current preamble bash generator**

```bash
cat /home/murilo/code/zzug/mstack/scripts/resolvers/preamble/generate-preamble-bash.ts
```

**Step 2: Edit `generate-preamble-bash.ts`**

Remove these sections from the generated bash string:

1. The `gstack-update-check` call and its output (`_UPD=...`)
2. The `_TEL` / `_TEL_PROMPTED` / `_TEL_START` / `_SESSION_ID` telemetry var setup
3. The `mkdir -p ~/.gstack/analytics` line
4. The `if [ "$_TEL" != "off" ]` block writing to `skill-usage.jsonl`
5. The `.pending-*` loop that calls `gstack-telemetry-log`
6. The `_LEARN_FILE` / `_LEARN_COUNT` / `gstack-learnings-search` block
7. The `gstack-timeline-log` background fork
8. The `_PROACTIVE` / `_PROACTIVE_PROMPTED` session vars (minor — up to you)
9. The gbrain doctor health-check block (inside `ctx.host === 'gbrain'...`)

Keep:

- `_BRANCH`, `echo "BRANCH: $_BRANCH"`
- `_SKILL_PREFIX`, `REPO_MODE`, `_LAKE_SEEN`, `_EXPLAIN_LEVEL`, `_QUESTION_TUNING`
- `_CHECKPOINT_MODE`, `_CHECKPOINT_PUSH`
- The `gstack-slug` eval

After editing, the generated preamble should just: detect branch, slug, repo-mode, config vars, and print them.

**Step 3: Read the completion status generator**

```bash
cat /home/murilo/code/zzug/mstack/scripts/resolvers/preamble/generate-completion-status.ts
```

**Step 4: Edit `generate-completion-status.ts`**

Remove from the generated bash:

1. The `skill-usage.jsonl` append
2. The `gstack-telemetry-log` call block
3. Any `_TEL` condition checks

Keep the visual completion banner and duration output.

**Step 5: Check `scripts/resolvers/preamble.ts` for imports of deleted modules**

```bash
cat /home/murilo/code/zzug/mstack/scripts/resolvers/preamble.ts
```

Remove any `import` statements for `learnings`, `gbrain`, `make-pdf`, `codex-helpers`. Update the exported `generatePreamble` function to not call the deleted resolvers.

**Step 6: Check `scripts/resolvers/index.ts` for deleted exports**

```bash
cat /home/murilo/code/zzug/mstack/scripts/resolvers/index.ts
```

Remove exports for `learnings`, `gbrain`, `make-pdf`, `codex-helpers`.

**Step 7: Run TypeScript type-check**

```bash
cd /home/murilo/code/zzug/mstack && bun run tsc --noEmit 2>&1 | head -40
```

Fix any import errors.

**Step 8: Commit**

```bash
git add scripts/resolvers/
git commit -m "chore: strip telemetry, update-check, and learnings from preamble generators"
```

---

## Task 5: Clean up `gen-skill-docs.ts` and SKILL.md template

**Files:**

- Modify: `scripts/gen-skill-docs.ts`
- Modify: `SKILL.md.tmpl`

**Step 1: Read gen-skill-docs.ts**

```bash
cat /home/murilo/code/zzug/mstack/scripts/gen-skill-docs.ts
```

**Step 2: Remove references to deleted skills**

In `gen-skill-docs.ts`, there is likely a list of skill directories to generate docs for. Remove entries for all deleted skills:
`benchmark`, `benchmark-models`, `canary`, `pair-agent`, `freeze`, `unfreeze`, `land-and-deploy`, `ship`, `codex`, `careful`, `learn`, `context-save`, `context-restore`, `skillify`, `devex-review`, `plan-devex-review`, `extension`, `setup-gbrain`, `sync-gbrain`, `open-gstack-browser`, `setup-browser-cookies`, `setup-deploy`, `gstack-upgrade`, `health`, `model-overlays`, `make-pdf`, `qa-only`.

Also remove any resolver imports for `learnings`, `gbrain`, `make-pdf`, `codex-helpers`.

**Step 3: Read and update SKILL.md.tmpl**

```bash
cat /home/murilo/code/zzug/mstack/SKILL.md.tmpl | head -200
```

Remove any `## Skill routing` entries pointing to deleted skills. Update the skill list to only show surviving skills.

**Step 4: Regenerate SKILL.md files**

```bash
cd /home/murilo/code/zzug/mstack && bun run gen:skill-docs 2>&1 | tail -30
```

Expected: runs without errors. Any "file not found" errors for deleted skill templates are fine — they should be skipped. If they error out, remove the corresponding entry from `gen-skill-docs.ts`.

**Step 5: Verify SKILL.md content**

```bash
grep -n "telemetry\|update-check\|gstack-telemetry\|skill-usage.jsonl" /home/murilo/code/zzug/mstack/SKILL.md | head -20
```

These should not appear (or appear only in explanatory text, not in bash blocks).

**Step 6: Commit**

```bash
git add scripts/gen-skill-docs.ts SKILL.md SKILL.md.tmpl
git add */SKILL.md 2>/dev/null || true
git commit -m "chore: remove deleted skills from gen-skill-docs and regenerate SKILL.md files"
```

---

## Task 6: Clean up `setup` script

**Files:**

- Modify: `setup`

**Step 1: Read the setup script**

```bash
cat /home/murilo/code/zzug/mstack/setup
```

**Step 2: Remove from setup**

1. All blocks that symlink/install deleted skill directories (benchmark, canary, pair-agent, freeze/unfreeze, land-and-deploy, ship, codex, careful, learn, context-save/restore, skillify, devex-review, plan-devex-review, extension, setup-gbrain, sync-gbrain, open-gstack-browser, setup-browser-cookies, setup-deploy, gstack-upgrade, health, model-overlays, make-pdf, qa-only, connect-chrome alias)
2. The `gstack-session-update` team-mode hook registration block (lines ~1069+)
3. The `gstack-settings-hook add/remove` calls
4. Any block that registers `gstack-update-check`, `gstack-telemetry-*` or references `auto_upgrade` / `team_mode` config keys
5. The welcome/legacy-cleanup block referring to `/gstack-upgrade`

Keep all symlink logic for surviving skills and core bin scripts.

**Step 3: Run setup in dry-run / verify it executes without error**

```bash
cd /home/murilo/code/zzug/mstack && bash -n setup && echo "syntax OK"
```

Expected: "syntax OK"

**Step 4: Commit**

```bash
git add setup
git commit -m "chore: remove deleted skills and update/telemetry hooks from setup script"
```

---

## Task 7: Clean up `package.json` scripts

**Files:**

- Modify: `package.json`

**Step 1: Read current scripts section**

```bash
cat /home/murilo/code/zzug/mstack/package.json
```

**Step 2: Remove from `scripts`**

- `"test:codex"` and `"test:codex:all"` (deleted)
- `"test:gemini"` and `"test:gemini:all"` (deleted)
- `"analytics"` (deleted analytics.ts)
- Any other scripts referencing deleted files

**Step 3: Remove from `build` script**

The `build` script currently compiles `make-pdf/src/cli.ts` into `make-pdf/dist/pdf`. Remove that step. Also remove `vendor:xterm` if it only serves the extension (check if browse also needs it — likely not after extension removal).

```bash
grep "xterm\|make-pdf\|extension" /home/murilo/code/zzug/mstack/package.json
```

**Step 4: Remove from `dependencies` / `devDependencies`**

- `@ngrok/ngrok` — used by pair-agent only (deleted)
- `xterm` and `xterm-addon-fit` — only used by extension (deleted); verify browse doesn't use them: `grep -r "xterm" browse/src/ | head -5`
- `puppeteer-core` — check if still needed: `grep -r "puppeteer-core" browse/src/ | head -5`

**Step 5: Update `bin` section**

Remove `"make-pdf"` entry.

**Step 6: Run install to verify lockfile stays clean**

```bash
cd /home/murilo/code/zzug/mstack && bun install 2>&1 | tail -10
```

**Step 7: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: remove deleted scripts and dependencies from package.json"
```

---

## Task 8: Run free tests to verify everything is clean

**Step 1: Run the free test suite**

```bash
cd /home/murilo/code/zzug/mstack && bun test browse/test/ test/ --ignore 'test/skill-e2e-*.test.ts' --ignore test/skill-llm-eval.test.ts --ignore test/skill-routing-e2e.test.ts --ignore test/codex-e2e.test.ts --ignore test/gemini-e2e.test.ts 2>&1 | tail -50
```

**Step 2: Fix any failures**

Common causes:

- A test imports a deleted module (fix: delete the test file or update the import)
- A resolver references a deleted bin script (fix: remove the reference)
- `gen-skill-docs.ts` references a deleted skill template (fix: remove the entry)

**Step 3: Check for stray telemetry references**

```bash
grep -r "gstack-telemetry\|skill-usage.jsonl\|gstack-update-check\|gstack-timeline\|gstack-learnings\|gstack-analytics" /home/murilo/code/zzug/mstack/scripts/ 2>/dev/null | grep -v ".tmpl" | grep -v "node_modules"
```

Expected: no output (all references removed).

**Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "chore: fix remaining references after telemetry + skill removal"
```

---

## Task 9: Update CLAUDE.md to reflect simplified repo

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Read CLAUDE.md**

```bash
cat /home/murilo/code/zzug/mstack/CLAUDE.md
```

**Step 2: Update project structure section**

- Remove entries for deleted skill directories from the `## Project structure` tree
- Remove the `## Compiled binaries` section's reference to `make-pdf/dist/pdf`
- Remove the `gstack-upgrade` migration section references
- Remove the `pair-agent` / extension sidebar architecture sections (big blocks — they're irrelevant without the extension)
- Remove the `## Publishing native OpenClaw skills to ClawHub` section if openclaw is now unused
- Remove the `## GSTACK_* env-shim for Conductor` section if it only applies to deleted conductors

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect simplified repo structure"
```

---

## Verification Checklist

After all tasks complete, verify:

```bash
# 1. No deleted directories remain
ls /home/murilo/code/zzug/mstack/ | sort

# 2. Free tests pass
bun test browse/test/ test/ --ignore 'test/skill-e2e-*.test.ts' --ignore test/skill-llm-eval.test.ts --ignore test/skill-routing-e2e.test.ts --ignore test/codex-e2e.test.ts --ignore test/gemini-e2e.test.ts

# 3. SKILL.md generation works
bun run gen:skill-docs

# 4. No telemetry refs in generated SKILL.md
grep -r "telemetry\|skill-usage.jsonl\|gstack-update-check" office-hours/SKILL.md plan-ceo-review/SKILL.md investigate/SKILL.md

# 5. Setup script syntax is valid
bash -n setup && echo "OK"
```
