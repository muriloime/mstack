import type { TemplateContext } from "../types";

export function generateUpgradeCheck(ctx: TemplateContext): string {
  return `If \`PROACTIVE\` is \`"false"\`, do not auto-invoke or proactively suggest skills. If a skill seems useful, ask: "I think /skillname might help here — want me to run it?"

If \`SKILL_PREFIX\` is \`"true"\`, suggest/invoke \`/mstack-*\` names. Disk paths stay \`${ctx.paths.skillRoot}/[skill-name]/SKILL.md\`.

After startup checks, continue workflow.`;
}
