import type { TemplateContext } from "../types";

export function generateProactivePrompt(ctx: TemplateContext): string {
  return `If \`PROACTIVE_PROMPTED\` is \`no\`: ask once:

> Let mstack proactively suggest skills, like /qa for "does this work?" or /investigate for bugs?

Options:
- A) Keep it on (recommended)
- B) Turn it off — I'll type /commands myself

If A: run \`${ctx.paths.binDir}/mstack-config set proactive true\`
If B: run \`${ctx.paths.binDir}/mstack-config set proactive false\`

Always run:
\`\`\`bash
touch ~/.mstack/.proactive-prompted
\`\`\`

Skip if \`PROACTIVE_PROMPTED\` is \`yes\`.`;
}
