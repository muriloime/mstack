import type { TemplateContext } from '../types';

export function generateTelemetryPrompt(ctx: TemplateContext): string {
  return `If \`TEL_PROMPTED\` is \`no\` AND \`LAKE_INTRO\` is \`yes\`: ask telemetry once via AskUserQuestion:

> Help mstack get better. Share usage data only: skill, duration, crashes, stable device ID. No code, file paths, or repo names.

Options:
- A) Help mstack get better! (recommended)
- B) No thanks

If A: run \`${ctx.paths.binDir}/mstack-config set telemetry community\`

If B: ask follow-up:

> Anonymous mode sends only aggregate usage, no unique ID.

Options:
- A) Sure, anonymous is fine
- B) No thanks, fully off

If B→A: run \`${ctx.paths.binDir}/mstack-config set telemetry anonymous\`
If B→B: run \`${ctx.paths.binDir}/mstack-config set telemetry off\`

Always run:
\`\`\`bash
touch ~/.mstack/.telemetry-prompted
\`\`\`

Skip if \`TEL_PROMPTED\` is \`yes\`.`;
}
