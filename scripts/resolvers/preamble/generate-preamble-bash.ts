import type { TemplateContext } from "../types";
import { getHostConfig } from "../../../hosts/index";

export function generatePreambleBash(ctx: TemplateContext): string {
  const hostConfig = getHostConfig(ctx.host);
  const runtimeRoot = hostConfig.usesEnvVars
    ? `_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
MSTACK_ROOT="$HOME/${hostConfig.globalRoot}"
[ -n "$_ROOT" ] && [ -d "$_ROOT/${ctx.paths.localSkillRoot}" ] && MSTACK_ROOT="$_ROOT/${ctx.paths.localSkillRoot}"
MSTACK_BIN="$MSTACK_ROOT/bin"
MSTACK_BROWSE="$MSTACK_ROOT/browse/dist"
MSTACK_DESIGN="$MSTACK_ROOT/design/dist"
`
    : "";

  return `## Preamble (run first)

\`\`\`bash
${runtimeRoot}_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(${ctx.paths.binDir}/mstack-config get skill_prefix 2>/dev/null || echo "false")
echo "SKILL_PREFIX: $_SKILL_PREFIX"
_PROACTIVE=$(${ctx.paths.binDir}/mstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.mstack/.proactive-prompted ] && echo "yes" || echo "no")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
source <(${ctx.paths.binDir}/mstack-repo-mode 2>/dev/null) || true
REPO_MODE=\${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.mstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_EXPLAIN_LEVEL=$(${ctx.paths.binDir}/mstack-config get explain_level 2>/dev/null || echo "default")
if [ "$_EXPLAIN_LEVEL" != "default" ] && [ "$_EXPLAIN_LEVEL" != "terse" ]; then _EXPLAIN_LEVEL="default"; fi
echo "EXPLAIN_LEVEL: $_EXPLAIN_LEVEL"
_QUESTION_TUNING=$(${ctx.paths.binDir}/mstack-config get question_tuning 2>/dev/null || echo "false")
echo "QUESTION_TUNING: $_QUESTION_TUNING"
eval "$(${ctx.paths.binDir}/mstack-slug 2>/dev/null)" 2>/dev/null || true
_HAS_ROUTING="no"
if [ -f CLAUDE.md ] && grep -q "## Skill routing" CLAUDE.md 2>/dev/null; then
  _HAS_ROUTING="yes"
fi
_ROUTING_DECLINED=$(${ctx.paths.binDir}/mstack-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
echo "MODEL_OVERLAY: ${ctx.model ?? "none"}"
_CHECKPOINT_MODE=$(${ctx.paths.binDir}/mstack-config get checkpoint_mode 2>/dev/null || echo "explicit")
_CHECKPOINT_PUSH=$(${ctx.paths.binDir}/mstack-config get checkpoint_push 2>/dev/null || echo "false")
echo "CHECKPOINT_MODE: $_CHECKPOINT_MODE"
echo "CHECKPOINT_PUSH: $_CHECKPOINT_PUSH"
[ -n "$OPENCLAW_SESSION" ] && echo "SPAWNED_SESSION: true" || true
\`\`\``;
}
