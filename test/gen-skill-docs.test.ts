import { describe, test, expect } from "bun:test";
import { COMMAND_DESCRIPTIONS } from "../browse/src/commands";
import { SNAPSHOT_FLAGS } from "../browse/src/snapshot";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const ROOT = path.resolve(import.meta.dir, "..");
const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

function extractDescription(content: string): string {
  const fmEnd = content.indexOf("\n---", 4);
  expect(fmEnd).toBeGreaterThan(0);
  const frontmatter = content.slice(4, fmEnd);
  const lines = frontmatter.split("\n");
  let description = "";
  let inDescription = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^description:\s*\|?\s*$/)) {
      inDescription = true;
      continue;
    }
    if (line.match(/^description:\s*\S/)) {
      return line.replace(/^description:\s*/, "").trim();
    }
    if (inDescription) {
      if (line === "" || line.match(/^\s/)) {
        descLines.push(line.replace(/^  /, ""));
      } else {
        break;
      }
    }
  }

  if (descLines.length > 0) {
    description = descLines.join("\n").trim();
  }
  return description;
}

function extractMarkdownSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startMatch = content.match(new RegExp(`^${escaped}.*$`, "m"));
  expect(startMatch?.index).toBeDefined();
  const start = startMatch!.index!;
  const afterHeading = start + startMatch![0].length;
  const nextSection = content.slice(afterHeading).match(/\n## /);
  const end =
    nextSection?.index === undefined
      ? content.length
      : afterHeading + nextSection.index;
  return content.slice(start, end).trim();
}

function extractPreambleBeforeWorkflow(
  content: string,
  workflowMarkers: string[],
): string {
  const markerIndexes = workflowMarkers
    .map((marker) => content.indexOf(marker))
    .filter((index) => index >= 0);
  expect(markerIndexes.length).toBeGreaterThan(0);
  return content.slice(0, Math.min(...markerIndexes));
}

function isRepoRootSymlink(candidateDir: string): boolean {
  try {
    return fs.realpathSync(candidateDir) === fs.realpathSync(ROOT);
  } catch {
    return false;
  }
}

// Dynamic template discovery — matches the generator's findTemplates() behavior.
// New skills automatically get test coverage without updating a static list.
const ALL_SKILLS = (() => {
  const skills: Array<{ dir: string; name: string }> = [];
  if (fs.existsSync(path.join(ROOT, "SKILL.md.tmpl"))) {
    skills.push({ dir: ".", name: "root mstack" });
  }
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith(".") ||
      entry.name === "node_modules"
    )
      continue;
    if (fs.existsSync(path.join(ROOT, entry.name, "SKILL.md.tmpl"))) {
      skills.push({ dir: entry.name, name: entry.name });
    }
  }
  return skills;
})();

const CLAUDE_SKIPPED_SKILL_DIRS = new Set(["claude"]);
const CLAUDE_GENERATED_SKILLS = ALL_SKILLS.filter(
  (skill) => !CLAUDE_SKIPPED_SKILL_DIRS.has(skill.dir),
);

describe("gen-skill-docs", () => {
  test("generated SKILL.md contains all command categories", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    const categories = new Set(
      Object.values(COMMAND_DESCRIPTIONS).map((d) => d.category),
    );
    for (const cat of categories) {
      expect(content).toContain(`### ${cat}`);
    }
  });

  test("generated SKILL.md contains all commands", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      const display = meta.usage || cmd;
      expect(content).toContain(display);
    }
  });

  test("command table is sorted alphabetically within categories", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    // Extract command names from the Navigation section as a test
    const navSection = content.match(
      /### Navigation\n\|.*\n\|.*\n([\s\S]*?)(?=\n###|\n## )/,
    );
    expect(navSection).not.toBeNull();
    const rows = navSection![1].trim().split("\n");
    const commands = rows
      .map((r) => {
        const match = r.match(/\| `(\w+)/);
        return match ? match[1] : "";
      })
      .filter(Boolean);
    const sorted = [...commands].sort();
    expect(commands).toEqual(sorted);
  });

  test("generated header is present in SKILL.md", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    expect(content).toContain("AUTO-GENERATED from SKILL.md.tmpl");
    expect(content).toContain("Regenerate: bun run gen:skill-docs");
  });

  test("generated header is present in browse/SKILL.md", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "browse", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("AUTO-GENERATED from SKILL.md.tmpl");
  });

  test("snapshot flags section contains all flags", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    for (const flag of SNAPSHOT_FLAGS) {
      expect(content).toContain(flag.short);
      expect(content).toContain(flag.description);
    }
  });

  test("every skill has a SKILL.md.tmpl template", () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = path.join(ROOT, skill.dir, "SKILL.md.tmpl");
      expect(fs.existsSync(tmplPath)).toBe(true);
    }
  });

  test("every skill has a generated SKILL.md with auto-generated header", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const mdPath = path.join(ROOT, skill.dir, "SKILL.md");
      expect(fs.existsSync(mdPath)).toBe(true);
      const content = fs.readFileSync(mdPath, "utf-8");
      expect(content).toContain("AUTO-GENERATED from SKILL.md.tmpl");
      expect(content).toContain("Regenerate: bun run gen:skill-docs");
    }
  });

  test("every generated SKILL.md has valid YAML frontmatter", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toContain("name:");
      expect(content).toContain("description:");
    }
  });

  test(`every generated SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(
        MAX_SKILL_DESCRIPTION_LENGTH,
      );
    }
  });

  test("Claude outside-voice skill is not generated for Claude host", () => {
    expect(fs.existsSync(path.join(ROOT, "claude", "SKILL.md.tmpl"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(ROOT, "claude", "SKILL.md"))).toBe(false);
  });

  test(`every Codex SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    const agentsDir = path.join(ROOT, ".agents", "skills");
    if (!fs.existsSync(agentsDir)) return; // skip if not generated
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(
        MAX_SKILL_DESCRIPTION_LENGTH,
      );
    }
  });

  test("every Codex SKILL.md description stays under 900-char warning threshold", () => {
    const WARN_THRESHOLD = 900;
    const agentsDir = path.join(ROOT, ".agents", "skills");
    if (!fs.existsSync(agentsDir)) return;
    const violations: string[] = [];
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      const description = extractDescription(content);
      if (description.length > WARN_THRESHOLD) {
        violations.push(
          `${entry.name}: ${description.length} chars (limit ${MAX_SKILL_DESCRIPTION_LENGTH}, ${MAX_SKILL_DESCRIPTION_LENGTH - description.length} remaining)`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test("package.json version matches VERSION file", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"),
    );
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    expect(pkg.version).toBe(version);
  });

  test("generated files are fresh (match --dry-run)", () => {
    const result = Bun.spawnSync(
      ["bun", "run", "scripts/gen-skill-docs.ts", "--dry-run"],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every skill should be FRESH
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const file = skill.dir === "." ? "SKILL.md" : `${skill.dir}/SKILL.md`;
      expect(output).toContain(`FRESH: ${file}`);
    }
    expect(output).not.toContain("STALE");
  });

  test("no generated SKILL.md contains unresolved placeholders", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      const unresolved = content.match(/\{\{[A-Z_]+\}\}/g);
      expect(unresolved).toBeNull();
    }
  });

  test("templates contain placeholders", () => {
    const rootTmpl = fs.readFileSync(path.join(ROOT, "SKILL.md.tmpl"), "utf-8");
    expect(rootTmpl).toContain("{{COMMAND_REFERENCE}}");
    expect(rootTmpl).toContain("{{SNAPSHOT_FLAGS}}");
    expect(rootTmpl).toContain("{{PREAMBLE}}");

    const browseTmpl = fs.readFileSync(
      path.join(ROOT, "browse", "SKILL.md.tmpl"),
      "utf-8",
    );
    expect(browseTmpl).toContain("{{COMMAND_REFERENCE}}");
    expect(browseTmpl).toContain("{{SNAPSHOT_FLAGS}}");
    expect(browseTmpl).toContain("{{PREAMBLE}}");
  });

  test("generated SKILL.md contains branch detection", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    expect(content).toContain("_BRANCH");
    expect(content).toContain("git branch --show-current");
  });

  test("tier 2+ skills contain ELI10 simplification rules (AskUserQuestion format)", () => {
    // Root SKILL.md is tier 1 (no AskUserQuestion format). Check a tier 2+ skill instead.
    // v1.7.0.0 Pros/Cons format uses "ELI10 (ALWAYS)" rather than "Simplify (ELI10".
    const content = fs.readFileSync(
      path.join(ROOT, "cso", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("ELI10");
    expect(content).toContain("plain English");
    expect(content).toContain("not function names");
  });

  test("tier 1 skills do NOT contain AskUserQuestion format", () => {
    // Root SKILL.md is tier 1 — check it directly
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    expect(content).not.toContain("## AskUserQuestion Format");
    expect(content).not.toContain("## Completeness Principle");
  });

  test("plan-review generated preambles stay under the Option A budget", () => {
    const reviewSkills = [
      {
        path: path.join(ROOT, "plan-ceo-review", "SKILL.md"),
        markers: [
          "# Mega Plan Review Mode",
          "## Step 0: Detect platform and base branch",
        ],
      },
      {
        path: path.join(ROOT, "plan-eng-review", "SKILL.md"),
        markers: ["# Plan Review Mode"],
      },
    ];

    // Plan skills carry the same preamble surface as other tier-≥2 skills
    // (Artifacts Sync, Context Recovery, Routing Injection are load-bearing
    // functionality, not optional). Budget is set to current size + small
    // headroom; ratchet down if a future slim trims real bytes.
    // Ratcheted from 33000 → 35000 when the gbrain context-load block was
    // added (per /sync-gbrain plan §4). Ratcheted 35000 → 36500 in v1.27.0.0
    // when generate-brain-sync-block.ts gained the gbrain_mcp_mode probe +
    // remote-mode ARTIFACTS_SYNC status line (Path 4 of /setup-gbrain).
    // Ratcheted 36500 → 39000 in the contributor wave when #1205 added the
    // \\u-escape CJK rule (rule 12 + self-check item) to the AskUserQuestion
    // preamble.
    for (const skill of reviewSkills) {
      const content = fs.readFileSync(skill.path, "utf-8");
      const preamble = extractPreambleBeforeWorkflow(content, skill.markers);
      expect(Buffer.byteLength(preamble, "utf-8")).toBeLessThan(39_000);
    }
  });

  test("voice and writing-style preamble sections stay compact", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    const voice = extractMarkdownSection(content, "## Voice");
    const writingStyle = extractMarkdownSection(content, "## Writing Style");

    expect(Buffer.byteLength(voice, "utf-8")).toBeLessThan(3_000);
    expect(Buffer.byteLength(writingStyle, "utf-8")).toBeLessThan(2_000);
  });

  test("slim voice section preserves the mstack voice contract", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    const voice = extractMarkdownSection(content, "## Voice");

    expect(voice).toMatch(/lead with the point|direct/i);
    expect(voice).toMatch(/file|function|line|command|real numbers/i);
    expect(voice).toMatch(/user.*outcome|user.*experience|real user/i);
    expect(voice).toMatch(/corporate|academic|PR|hype/i);
    expect(voice).toMatch(/AI vocabulary|delve|crucial|robust/i);
    expect(voice).toMatch(
      /user decides|user.*context|sovereignty|recommendation, not a decision/i,
    );
  });

  test("preamble .pending-* glob is zsh-safe (uses find, not shell glob)", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      if (!content.includes(".pending-")) continue;
      // Must NOT have a bare shell glob ".pending-*" outside of find's -name argument
      expect(content).not.toMatch(/for _PF in [^\n]*\/\.pending-\*/);
      // Must use find to avoid zsh NOMATCH error on glob expansion
      expect(content).toContain(
        "find ~/.mstack/analytics -maxdepth 1 -name '.pending-*'",
      );
    }
  });

  test("bash blocks with shell globs are zsh-safe (setopt guard or find)", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      const bashBlocks = [...content.matchAll(/```bash\n([\s\S]*?)```/g)].map(
        (m) => m[1],
      );

      for (const block of bashBlocks) {
        const lines = block.split("\n");

        for (const line of lines) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith("#")) continue;
          if (!trimmed.includes("*")) continue;
          // Skip lines where * is inside find -name, git pathspecs, or $(find)
          if (/\bfind\b/.test(trimmed)) continue;
          if (/\bgit\b/.test(trimmed)) continue;
          if (/\$\(find\b/.test(trimmed)) continue;

          // Check 1: "for VAR in <glob>" must use $(find ...) — caught above by the
          // $(find check, so any surviving for-in with a glob pattern is a violation
          if (/\bfor\s+\w+\s+in\b/.test(trimmed) && /\*\./.test(trimmed)) {
            throw new Error(
              `Unsafe for-in glob in ${skill.dir}/SKILL.md: "${trimmed}". ` +
                `Use \`for f in $(find ... -name '*.ext')\` for zsh compatibility.`,
            );
          }

          // Check 2: ls/cat/rm/grep with glob file args must have setopt guard
          const isGlobCmd =
            /\b(?:ls|cat|rm|grep)\b/.test(trimmed) &&
            /(?:\/\*[a-z.*]|\*\.[a-z])/.test(trimmed);
          if (isGlobCmd) {
            expect(block).toContain("setopt +o nomatch");
          }
        }
      }
    }
  });

  test("qa template uses QA_METHODOLOGY placeholder", () => {
    const qaTmpl = fs.readFileSync(
      path.join(ROOT, "qa", "SKILL.md.tmpl"),
      "utf-8",
    );
    expect(qaTmpl).toContain("{{QA_METHODOLOGY}}");
  });

  test("QA_METHODOLOGY appears expanded in qa generated file", () => {
    const qaContent = fs.readFileSync(
      path.join(ROOT, "qa", "SKILL.md"),
      "utf-8",
    );

    expect(qaContent).toContain("Health Score Rubric");
    expect(qaContent).toContain("Framework-Specific Guidance");
    expect(qaContent).toContain("Important Rules");
    expect(qaContent).toContain("Phase 1");
    expect(qaContent).toContain("Phase 6");
  });

  test("qa has fix-loop tools and phases", () => {
    const qaContent = fs.readFileSync(
      path.join(ROOT, "qa", "SKILL.md"),
      "utf-8",
    );
    // Should have Edit, Glob, Grep in allowed-tools
    expect(qaContent).toContain("Edit");
    expect(qaContent).toContain("Glob");
    expect(qaContent).toContain("Grep");
    // Should have fix-loop phases
    expect(qaContent).toContain("Phase 7");
    expect(qaContent).toContain("Phase 8");
    expect(qaContent).toContain("Fix Loop");
    expect(qaContent).toContain("Triage");
    expect(qaContent).toContain("WTF");
  });
});

describe("BASE_BRANCH_DETECT resolver", () => {
  // Find a generated SKILL.md that uses the placeholder (retro uses BASE_BRANCH_DETECT)
  const retroContent = fs.readFileSync(
    path.join(ROOT, "retro", "SKILL.md"),
    "utf-8",
  );

  test("resolver output contains PR base detection command", () => {
    expect(retroContent).toContain("gh pr view --json baseRefName");
  });

  test("resolver output contains repo default branch detection command", () => {
    expect(retroContent).toContain("gh repo view --json defaultBranchRef");
  });

  test("resolver output contains fallback to main", () => {
    expect(retroContent).toMatch(/fall\s*back\s+to\s+`main`/i);
  });

  test('resolver output uses "the base branch" phrasing', () => {
    expect(retroContent).toContain("the base branch");
  });

  test("resolver output contains GitLab CLI commands", () => {
    expect(retroContent).toContain("glab");
  });

  test("resolver output contains git-native fallback", () => {
    expect(retroContent).toContain("git symbolic-ref");
  });

  test("resolver output mentions GitLab platform", () => {
    expect(retroContent).toMatch(/gitlab/i);
  });
});

describe("GitLab support in generated skills", () => {
  const retroContent = fs.readFileSync(
    path.join(ROOT, "retro", "SKILL.md"),
    "utf-8",
  );

  test("retro contains GitLab MR number extraction", () => {
    expect(retroContent).toContain("[#!]");
  });

  test("retro uses BASE_BRANCH_DETECT (contains glab)", () => {
    expect(retroContent).toContain("glab");
  });
});

/**
 * Quality evals — catch description regressions.
 *
 * These test that generated output is *useful for an AI agent*,
 * not just structurally valid. Each test targets a specific
 * regression we actually shipped and caught in review.
 */
describe("description quality evals", () => {
  // Regression: snapshot flags lost value hints (-d <N>, -s <sel>, -o <path>)
  test("snapshot flags with values include value hints in output", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    for (const flag of SNAPSHOT_FLAGS) {
      if (flag.takesValue) {
        expect(flag.valueHint).toBeDefined();
        expect(content).toContain(`${flag.short} ${flag.valueHint}`);
      }
    }
  });

  // Regression: "is" lost the valid states enum
  test("is command lists valid state values", () => {
    const desc = COMMAND_DESCRIPTIONS["is"].description;
    for (const state of [
      "visible",
      "hidden",
      "enabled",
      "disabled",
      "checked",
      "editable",
      "focused",
    ]) {
      expect(desc).toContain(state);
    }
  });

  // Regression: "press" lost common key examples
  test("press command lists example keys", () => {
    const desc = COMMAND_DESCRIPTIONS["press"].description;
    expect(desc).toContain("Enter");
    expect(desc).toContain("Tab");
    expect(desc).toContain("Escape");
  });

  // Regression: "console" lost --errors filter note
  test("console command describes --errors behavior", () => {
    const desc = COMMAND_DESCRIPTIONS["console"].description;
    expect(desc).toContain("--errors");
  });

  // Regression: snapshot -i lost "@e refs" context
  test("snapshot -i mentions @e refs", () => {
    const flag = SNAPSHOT_FLAGS.find((f) => f.short === "-i")!;
    expect(flag.description).toContain("@e");
  });

  // Regression: snapshot -C lost "@c refs" context
  test("snapshot -C mentions @c refs", () => {
    const flag = SNAPSHOT_FLAGS.find((f) => f.short === "-C")!;
    expect(flag.description).toContain("@c");
  });

  // Guard: every description must be at least 8 chars (catches empty or stub descriptions)
  test("all command descriptions have meaningful length", () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description.length).toBeGreaterThanOrEqual(8);
    }
  });

  // Guard: snapshot flag descriptions must be at least 10 chars
  test("all snapshot flag descriptions have meaningful length", () => {
    for (const flag of SNAPSHOT_FLAGS) {
      expect(flag.description.length).toBeGreaterThanOrEqual(10);
    }
  });

  // Guard: descriptions must not contain pipe (breaks markdown table cells)
  // Usage strings are backtick-wrapped in the table so pipes there are safe.
  test("no command description contains pipe character", () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description).not.toContain("|");
    }
  });

  // Guard: generated output uses → not ->
  test("generated SKILL.md uses unicode arrows", () => {
    const content = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    // Check the Tips section specifically (where we regressed -> from →)
    const tipsSection = content.slice(content.indexOf("## Tips"));
    expect(tipsSection).toContain("→");
    expect(tipsSection).not.toContain("->");
  });
});

describe("REVIEW_DASHBOARD resolver", () => {
  const REVIEW_SKILLS = [
    "plan-ceo-review",
    "plan-eng-review",
    "plan-design-review",
  ];

  for (const skill of REVIEW_SKILLS) {
    test(`review dashboard appears in ${skill} generated file`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("mstack-review");
      expect(content).toContain("REVIEW READINESS DASHBOARD");
    });
  }

  test("dashboard treats review as a valid Eng Review source", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("plan-eng-review, review, plan-design-review");
    expect(content).toContain("`review` (diff-scoped pre-landing review)");
    expect(content).toContain(
      "`plan-eng-review` (plan-stage architecture review)",
    );
  });

  test("shared dashboard propagates review source to plan-eng-review", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("plan-eng-review, review, plan-design-review");
    expect(content).toContain("`review` (diff-scoped pre-landing review)");
  });

  test("resolver output contains key dashboard elements", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("VERDICT");
    expect(content).toContain("CLEARED");
    expect(content).toContain("Eng Review");
    expect(content).toContain("7 days");
    expect(content).toContain("Design Review");
    expect(content).toContain("skip_eng_review");
  });

  test("dashboard bash block includes git HEAD for staleness detection", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("git rev-parse --short HEAD");
    expect(content).toContain("---HEAD---");
  });

  test("dashboard includes staleness detection prose", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Staleness detection");
    expect(content).toContain("commit");
  });

  for (const skill of REVIEW_SKILLS) {
    test(`${skill} contains review chaining section`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("Review Chaining");
    });

    test(`${skill} Review Log includes commit field`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain('"commit"');
    });
  }

  test("plan-ceo-review chaining mentions eng and design reviews", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("/plan-eng-review");
    expect(content).toContain("/plan-design-review");
  });

  test("plan-eng-review chaining mentions design and ceo reviews", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("/plan-design-review");
    expect(content).toContain("/plan-ceo-review");
  });

  test("plan-design-review chaining mentions eng, ceo, and design skills", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("/plan-eng-review");
    expect(content).toContain("/plan-ceo-review");
    expect(content).toContain("/design-shotgun");
    expect(content).toContain("/design-html");
  });
});

// ─── Test Coverage Audit Resolver Tests ─────────────────────

describe("TEST_COVERAGE_AUDIT placeholders", () => {
  const planSkill = fs.readFileSync(
    path.join(ROOT, "plan-eng-review", "SKILL.md"),
    "utf-8",
  );
  const reviewSkill = fs.readFileSync(
    path.join(ROOT, "review", "SKILL.md"),
    "utf-8",
  );

  test("plan mode includes codepath tracing methodology", () => {
    const sharedPhrases = [
      "Trace data flow",
      "Diagram the execution",
      "Quality scoring rubric",
      "★★★",
      "★★",
      "GAP",
    ];
    for (const phrase of sharedPhrases) {
      expect(planSkill).toContain(phrase);
    }
    // Plan mode traces the plan, not a git diff
    expect(planSkill).toContain("Trace every codepath in the plan");
    expect(planSkill).not.toContain("git diff origin");
  });

  test("review mode uses Review Army for specialist dispatch", () => {
    expect(reviewSkill).toContain("Review Army");
    expect(reviewSkill).toContain("Specialist Dispatch");
    expect(reviewSkill).toContain("testing.md");
  });

  test("plan mode includes E2E decision matrix", () => {
    expect(planSkill).toContain("E2E Test Decision Matrix");
    expect(planSkill).toContain("→E2E");
    expect(planSkill).toContain("→EVAL");
  });

  test("plan mode includes regression rule", () => {
    expect(planSkill).toContain("REGRESSION RULE");
    expect(planSkill).toContain("IRON RULE");
  });

  test("plan mode includes test framework detection", () => {
    expect(planSkill).toContain("Test Framework Detection");
    expect(planSkill).toContain("CLAUDE.md");
  });

  test("plan mode adds tests to plan + includes test plan artifact", () => {
    expect(planSkill).toContain("Add missing tests to the plan");
    expect(planSkill).toContain("eng-review-test-plan");
    expect(planSkill).toContain("Test Plan Artifact");
  });

  test("review mode uses Fix-First + Review Army for specialist coverage", () => {
    expect(reviewSkill).toContain("Fix-First");
    expect(reviewSkill).toContain("INFORMATIONAL");
    expect(reviewSkill).toContain("Review Army");
    expect(reviewSkill).toContain("Testing");
  });

  test("review mode does NOT include test plan artifact", () => {
    expect(reviewSkill).not.toContain("Test Plan Artifact");
    expect(reviewSkill).not.toContain("eng-review-test-plan");
    expect(reviewSkill).not.toContain("ship-test-plan");
  });

  test("review/specialists/ directory has all expected checklist files", () => {
    const specDir = path.join(ROOT, "review", "specialists");
    const expected = [
      "testing.md",
      "maintainability.md",
      "security.md",
      "performance.md",
      "data-migration.md",
      "api-contract.md",
      "red-team.md",
    ];
    for (const f of expected) {
      expect(fs.existsSync(path.join(specDir, f))).toBe(true);
    }
  });

  test("each specialist file has standard header with scope and output format", () => {
    const specDir = path.join(ROOT, "review", "specialists");
    const files = fs.readdirSync(specDir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      const content = fs.readFileSync(path.join(specDir, f), "utf-8");
      expect(content).toContain("Scope:");
      expect(content.toLowerCase()).toMatch(/output|json/);
      expect(content).toContain("NO FINDINGS");
    }
  });
});

// --- {{PLAN_FILE_REVIEW_REPORT}} resolver tests ---

describe("PLAN_FILE_REVIEW_REPORT resolver", () => {
  const REVIEW_SKILLS = [
    "plan-ceo-review",
    "plan-eng-review",
    "plan-design-review",
  ];

  for (const skill of REVIEW_SKILLS) {
    test(`plan file review report appears in ${skill} generated file`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("GSTACK REVIEW REPORT");
    });
  }

  test("resolver output contains key report elements", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Trigger");
    expect(content).toContain("Findings");
    expect(content).toContain("VERDICT");
    expect(content).toContain("/plan-ceo-review");
    expect(content).toContain("/plan-eng-review");
    expect(content).toContain("/plan-design-review");
  });
});

// --- {{PLAN_COMPLETION_AUDIT}} resolver tests ---

describe("PLAN_COMPLETION_AUDIT placeholders", () => {
  const reviewSkill = fs.readFileSync(
    path.join(ROOT, "review", "SKILL.md"),
    "utf-8",
  );

  test("review SKILL.md contains plan completion in scope drift", () => {
    expect(reviewSkill).toContain("Plan File Discovery");
    expect(reviewSkill).toContain("Actionable Item Extraction");
    expect(reviewSkill).toContain("Integration with Scope Drift Detection");
  });

  test("review mode is INFORMATIONAL only", () => {
    expect(reviewSkill).toContain("INFORMATIONAL");
    expect(reviewSkill).toContain("MISSING REQUIREMENTS");
    expect(reviewSkill).toContain("SCOPE CREEP");
  });

  test("review includes plan file discovery methodology", () => {
    expect(reviewSkill).toContain("Plan File Discovery");
    expect(reviewSkill).toContain("Conversation context (primary)");
    expect(reviewSkill).toContain("Content-based search (fallback)");
  });
});

// --- Coverage gate tests ---

describe("Coverage gate in review", () => {
  const reviewSkill = fs.readFileSync(
    path.join(ROOT, "review", "SKILL.md"),
    "utf-8",
  );

  test("review SKILL.md delegates coverage to Testing specialist", () => {
    expect(reviewSkill).toContain("testing.md");
    expect(reviewSkill).toContain("INFORMATIONAL");
  });
});

// --- Retro plan completion ---

describe("Retro plan completion section", () => {
  const retroSkill = fs.readFileSync(
    path.join(ROOT, "retro", "SKILL.md"),
    "utf-8",
  );

  test("retro SKILL.md contains plan completion section", () => {
    expect(retroSkill).toContain("### Plan Completion");
    expect(retroSkill).toContain("plan_items_total");
    expect(retroSkill).toContain("Plan Completion This Period");
  });
});

// --- Plan status footer in preamble ---

describe("Plan status footer in preamble", () => {
  test("preamble contains plan status footer as neutral forward reference to EXIT PLAN MODE GATE", () => {
    // Read any skill that uses PREAMBLE
    const content = fs.readFileSync(
      path.join(ROOT, "office-hours", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Plan Status Footer");
    expect(content).toContain("GSTACK REVIEW REPORT");
    expect(content).toContain("ExitPlanMode");
    expect(content).toContain("EXIT PLAN MODE GATE");
    // The preamble must NOT impose review-report rules on operational skills
    // that have no review report. It's a forward reference, not enforcement.
    expect(content).not.toContain("NO REVIEWS YET");
  });
});

// --- Skill invocation during plan mode in preamble ---

describe("Skill invocation during plan mode in preamble", () => {
  test("preamble contains skill invocation plan mode section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "office-hours", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Skill Invocation During Plan Mode");
    expect(content).toContain("precedence over generic plan mode behavior");
    expect(content).toContain("Do not continue the workflow");
    expect(content).toContain("cancel the skill or leave plan mode");
  });
});

// --- {{SPEC_REVIEW_LOOP}} resolver tests ---

describe("SPEC_REVIEW_LOOP resolver", () => {
  const content = fs.readFileSync(
    path.join(ROOT, "office-hours", "SKILL.md"),
    "utf-8",
  );

  test("contains all 5 review dimensions", () => {
    for (const dim of [
      "Completeness",
      "Consistency",
      "Clarity",
      "Scope",
      "Feasibility",
    ]) {
      expect(content).toContain(dim);
    }
  });

  test("references Agent tool for subagent dispatch", () => {
    expect(content).toMatch(/Agent.*tool/i);
  });

  test("specifies max 3 iterations", () => {
    expect(content).toMatch(/3.*iteration|maximum.*3/i);
  });

  test("includes quality score", () => {
    expect(content).toContain("quality score");
  });

  test("includes metrics path", () => {
    expect(content).toContain("spec-review.jsonl");
  });

  test("includes convergence guard", () => {
    expect(content).toMatch(/[Cc]onvergence/);
  });

  test("includes graceful failure handling", () => {
    expect(content).toMatch(/skip.*review|unavailable/i);
  });
});

// --- {{DESIGN_SKETCH}} resolver tests ---

describe("DESIGN_SKETCH resolver", () => {
  const content = fs.readFileSync(
    path.join(ROOT, "office-hours", "SKILL.md"),
    "utf-8",
  );

  test("references DESIGN.md for design system constraints", () => {
    expect(content).toContain("DESIGN.md");
  });

  test("contains wireframe or sketch terminology", () => {
    expect(content).toMatch(/wireframe|sketch/i);
  });

  test("references browse binary for rendering", () => {
    expect(content).toContain("$B goto");
  });

  test("references screenshot capture", () => {
    expect(content).toContain("$B screenshot");
  });

  test("specifies rough aesthetic", () => {
    expect(content).toMatch(/[Rr]ough|hand-drawn/);
  });

  test("includes skip conditions", () => {
    expect(content).toMatch(/no UI component|skip/i);
  });
});

// --- {{CODEX_SECOND_OPINION}} resolver tests ---

describe("CODEX_SECOND_OPINION resolver", () => {
  const content = fs.readFileSync(
    path.join(ROOT, "office-hours", "SKILL.md"),
    "utf-8",
  );
  const codexContent = fs.readFileSync(
    path.join(ROOT, ".agents", "skills", "mstack-office-hours", "SKILL.md"),
    "utf-8",
  );

  test("Phase 3.5 section appears in office-hours SKILL.md", () => {
    expect(content).toContain("Phase 3.5: Cross-Model Second Opinion");
  });

  test("contains codex exec invocation", () => {
    expect(content).toContain("codex exec");
  });

  test("contains opt-in AskUserQuestion text", () => {
    expect(content).toContain(
      "second opinion from an independent AI perspective",
    );
  });

  test("contains cross-model synthesis instructions", () => {
    expect(content).toMatch(/[Ss]ynthesis/);
    expect(content).toContain("Where Claude agrees with the second opinion");
  });

  test("contains Claude subagent fallback", () => {
    expect(content).toContain("CODEX_NOT_AVAILABLE");
    expect(content).toContain("Agent tool");
    expect(content).toContain("SECOND OPINION (Claude subagent)");
  });

  test("contains premise revision check", () => {
    expect(content).toContain("Codex challenged premise");
  });

  test("contains error handling for auth, timeout, and empty", () => {
    expect(content).toMatch(/[Aa]uth.*fail/);
    expect(content).toMatch(/[Tt]imeout/);
    expect(content).toMatch(/[Ee]mpty response/);
  });

  test("Codex host variant does NOT contain the Phase 3.5 resolver output", () => {
    // The resolver returns '' for codex host, so the interactive section is stripped.
    // Static template references to "Phase 3.5" in prose/conditionals are fine.
    // Other resolvers (design review lite) may contain CODEX_NOT_AVAILABLE, so we
    // check for Phase 3.5-specific markers only.
    expect(codexContent).not.toContain("Phase 3.5: Cross-Model Second Opinion");
    expect(codexContent).not.toContain("TMPERR_OH");
    expect(codexContent).not.toContain("mstack-codex-oh-");
  });
});

// --- Codex filesystem boundary tests ---

describe("Codex filesystem boundary", () => {
  // Skills that call codex exec/review and should contain boundary text
  const CODEX_CALLING_SKILLS = [
    "autoplan", // /autoplan — CEO/design/eng voices
    "review", // /review — adversarial step resolver
    "plan-eng-review", // outside voice resolver
    "plan-ceo-review", // outside voice resolver
    "office-hours", // second opinion resolver
  ];

  const BOUNDARY_MARKER = "Do NOT read or execute any";

  test("boundary instruction appears in all skills that call codex", () => {
    for (const skill of CODEX_CALLING_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain(BOUNDARY_MARKER);
    }
  });

  test("review.ts CODEX_BOUNDARY constant is interpolated into resolver output", () => {
    // The adversarial step resolver should include boundary text in codex exec prompts
    const reviewContent = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    // Boundary should appear near codex exec invocations
    const boundaryIdx = reviewContent.indexOf(BOUNDARY_MARKER);
    const codexExecIdx = reviewContent.indexOf("codex exec");
    // Both must exist and boundary must come before a codex exec call
    expect(boundaryIdx).toBeGreaterThan(-1);
    expect(codexExecIdx).toBeGreaterThan(-1);
  });

  test("autoplan boundary text avoids host-specific paths for cross-host compatibility", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "autoplan", "SKILL.md.tmpl"),
      "utf-8",
    );
    // autoplan template uses generic 'skills/mstack' pattern instead of host-specific
    // paths like ~/.claude/ or .agents/skills (which break Codex/Claude output tests)
    const boundaryStart = content.indexOf("Filesystem Boundary");
    const boundaryEnd = content.indexOf("---", boundaryStart + 1);
    const boundarySection = content.slice(boundaryStart, boundaryEnd);
    expect(boundarySection).not.toContain("~/.claude/");
    expect(boundarySection).not.toContain(".agents/skills");
    expect(boundarySection).toContain("skills/mstack");
    expect(boundarySection).toContain(BOUNDARY_MARKER);
  });
});

// --- {{BENEFITS_FROM}} resolver tests ---

describe("BENEFITS_FROM resolver", () => {
  const ceoContent = fs.readFileSync(
    path.join(ROOT, "plan-ceo-review", "SKILL.md"),
    "utf-8",
  );
  const engContent = fs.readFileSync(
    path.join(ROOT, "plan-eng-review", "SKILL.md"),
    "utf-8",
  );

  test("plan-ceo-review contains prerequisite skill offer", () => {
    expect(ceoContent).toContain("Prerequisite Skill Offer");
    expect(ceoContent).toContain("/office-hours");
  });

  test("plan-eng-review contains prerequisite skill offer", () => {
    expect(engContent).toContain("Prerequisite Skill Offer");
    expect(engContent).toContain("/office-hours");
  });

  test("offer includes graceful decline", () => {
    expect(ceoContent).toContain("No worries");
  });

  test("skills without benefits-from do NOT have prerequisite offer", () => {
    const qaContent = fs.readFileSync(
      path.join(ROOT, "qa", "SKILL.md"),
      "utf-8",
    );
    expect(qaContent).not.toContain("Prerequisite Skill Offer");
  });

  test('inline invocation — no "another window" language', () => {
    expect(ceoContent).not.toContain("another window");
    expect(engContent).not.toContain("another window");
  });

  test("inline invocation — read-and-follow path present", () => {
    expect(ceoContent).toContain("office-hours/SKILL.md");
    expect(engContent).toContain("office-hours/SKILL.md");
  });

  test("BENEFITS_FROM delegates to INVOKE_SKILL pattern", () => {
    // Should contain the INVOKE_SKILL-style loading prose (not the old manual skip list)
    expect(engContent).toContain("Follow its instructions from top to bottom");
    expect(engContent).toContain("skipping these sections");
    expect(ceoContent).toContain("Follow its instructions from top to bottom");
  });
});

// --- {{INVOKE_SKILL}} resolver tests ---

describe("INVOKE_SKILL resolver", () => {
  const ceoContent = fs.readFileSync(
    path.join(ROOT, "plan-ceo-review", "SKILL.md"),
    "utf-8",
  );

  test("plan-ceo-review uses INVOKE_SKILL for mid-session office-hours fallback", () => {
    // The mid-session detection path should use INVOKE_SKILL-generated prose
    expect(ceoContent).toContain("office-hours/SKILL.md");
    expect(ceoContent).toContain("Follow its instructions from top to bottom");
  });

  test("INVOKE_SKILL output includes default skip list", () => {
    expect(ceoContent).toContain("Preamble (run first)");
    expect(ceoContent).toContain("Telemetry (run last)");
    expect(ceoContent).toContain("AskUserQuestion Format");
  });

  test("INVOKE_SKILL output includes error handling", () => {
    expect(ceoContent).toContain("If unreadable");
    expect(ceoContent).toContain("Could not load");
  });

  test("template uses {{INVOKE_SKILL:office-hours}} placeholder", () => {
    const tmpl = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md.tmpl"),
      "utf-8",
    );
    expect(tmpl).toContain("{{INVOKE_SKILL:office-hours}}");
  });
});

// --- Parameterized resolver infrastructure tests ---

describe("parameterized resolver support", () => {
  test("gen-skill-docs regex handles colon-separated args", () => {
    // Verify the template containing {{INVOKE_SKILL:office-hours}} was processed
    // without leaving unresolved placeholders
    const ceoContent = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    expect(ceoContent).not.toMatch(/\{\{INVOKE_SKILL:[^}]+\}\}/);
  });

  test("templates with parameterized resolvers pass unresolved check", () => {
    // All generated SKILL.md files should have no unresolved {{...}} placeholders
    const skillDirs = fs
      .readdirSync(ROOT)
      .filter((d) => fs.existsSync(path.join(ROOT, d, "SKILL.md")));
    for (const dir of skillDirs) {
      const content = fs.readFileSync(
        path.join(ROOT, dir, "SKILL.md"),
        "utf-8",
      );
      const unresolved = content.match(/\{\{[A-Z_]+(?::[^}]*)?\}\}/g);
      if (unresolved) {
        throw new Error(
          `${dir}/SKILL.md has unresolved placeholders: ${unresolved.join(", ")}`,
        );
      }
    }
  });
});

// --- Preamble routing injection tests ---

describe("preamble routing injection", () => {
  // Use a skill with a preamble — office-hours uses PREAMBLE placeholder
  const preambleContent = fs.readFileSync(
    path.join(ROOT, "office-hours", "SKILL.md"),
    "utf-8",
  );

  test("preamble bash checks for routing section in CLAUDE.md", () => {
    expect(preambleContent).toContain('grep -q "## Skill routing" CLAUDE.md');
    expect(preambleContent).toContain("HAS_ROUTING");
  });

  test("preamble bash reads routing_declined config", () => {
    expect(preambleContent).toContain("routing_declined");
    expect(preambleContent).toContain("ROUTING_DECLINED");
  });

  test("preamble includes routing injection AskUserQuestion", () => {
    expect(preambleContent).toContain("Add routing rules to CLAUDE.md");
    expect(preambleContent).toContain("I'll invoke skills manually");
  });

  test("routing injection respects prior decline", () => {
    expect(preambleContent).toContain("ROUTING_DECLINED");
    expect(preambleContent).toMatch(/routing_declined.*true/);
  });

  test("routing injection only fires when all conditions met", () => {
    // Must be: HAS_ROUTING=no AND ROUTING_DECLINED=false AND PROACTIVE_PROMPTED=yes
    expect(preambleContent).toContain("HAS_ROUTING");
    expect(preambleContent).toContain("ROUTING_DECLINED");
    expect(preambleContent).toContain("PROACTIVE_PROMPTED");
  });

  test("routing section content includes key routing rules", () => {
    expect(preambleContent).toContain("invoke /office-hours");
    expect(preambleContent).toContain("invoke /investigate");
    expect(preambleContent).toContain("invoke /qa");
  });

  test('routing section uses soft "when in doubt" policy, not hard "ALWAYS invoke"', () => {
    expect(preambleContent).toContain("When in doubt, invoke the skill");
    expect(preambleContent).not.toContain("Do NOT answer directly");
  });
});

// --- {{DESIGN_OUTSIDE_VOICES}} resolver tests ---

describe("DESIGN_OUTSIDE_VOICES resolver", () => {
  test("plan-design-review contains outside voices section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Design Outside Voices");
    expect(content).toContain("CODEX_AVAILABLE");
    expect(content).toContain("LITMUS SCORECARD");
  });

  test("design-review contains outside voices section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Design Outside Voices");
    expect(content).toContain("source audit");
  });

  test("design-consultation contains outside voices section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "design-consultation", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Design Outside Voices");
    expect(content).toContain("design direction");
  });

  test("branches correctly per skillName — different prompts", () => {
    const planContent = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    const consultContent = fs.readFileSync(
      path.join(ROOT, "design-consultation", "SKILL.md"),
      "utf-8",
    );
    // plan-design-review uses analytical prompt (high reasoning)
    expect(planContent).toContain('model_reasoning_effort="high"');
    // design-consultation uses creative prompt (medium reasoning)
    expect(consultContent).toContain('model_reasoning_effort="medium"');
  });
});

// --- {{DESIGN_HARD_RULES}} resolver tests ---

describe("DESIGN_HARD_RULES resolver", () => {
  test("plan-design-review Pass 4 contains hard rules", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Design Hard Rules");
    expect(content).toContain("Classifier");
    expect(content).toContain("MARKETING/LANDING PAGE");
    expect(content).toContain("APP UI");
  });

  test("design-review contains hard rules", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Design Hard Rules");
  });

  test("includes all 3 rule sets", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Landing page rules");
    expect(content).toContain("App UI rules");
    expect(content).toContain("Universal rules");
  });

  test("references shared AI slop blacklist items", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("3-column feature grid");
    expect(content).toContain("Purple/violet/indigo");
  });

  test("includes OpenAI hard rejection criteria", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Generic SaaS card grid");
    expect(content).toContain("Carousel with no narrative purpose");
  });

  test("includes OpenAI litmus checks", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Brand/product unmistakable");
    expect(content).toContain("premium with all decorative shadows removed");
  });
});

// --- Extended DESIGN_SKETCH resolver tests ---

describe("DESIGN_SKETCH extended with outside voices", () => {
  const content = fs.readFileSync(
    path.join(ROOT, "office-hours", "SKILL.md"),
    "utf-8",
  );

  test("contains outside design voices step", () => {
    expect(content).toContain("Outside design voices");
  });

  test("offers opt-in via AskUserQuestion", () => {
    expect(content).toContain("outside design perspectives");
  });

  test("still contains original wireframe steps", () => {
    expect(content).toContain("wireframe");
    expect(content).toContain("$B goto");
  });
});

// ─── Codex Generation Tests ─────────────────────────────────

describe("Codex generation (--host codex)", () => {
  const AGENTS_DIR = path.join(ROOT, ".agents", "skills");

  // .agents/ is gitignored (v0.11.2.0) — generate on demand for tests
  Bun.spawnSync(
    ["bun", "run", "scripts/gen-skill-docs.ts", "--host", "codex"],
    {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  // Dynamic discovery of expected Codex skills: all templates except /codex
  // Also excludes skills where .agents/skills/{name} is a symlink back to the repo root
  // (vendored dev mode — gen-skill-docs skips these to avoid overwriting Claude SKILL.md)
  const CODEX_SKILLS = (() => {
    const skills: Array<{ dir: string; codexName: string }> = [];
    const isSymlinkLoop = (codexName: string): boolean => {
      const agentSkillDir = path.join(ROOT, ".agents", "skills", codexName);
      try {
        return fs.realpathSync(agentSkillDir) === fs.realpathSync(ROOT);
      } catch {
        return false;
      }
    };
    if (fs.existsSync(path.join(ROOT, "SKILL.md.tmpl"))) {
      if (!isSymlinkLoop("mstack")) {
        skills.push({ dir: ".", codexName: "mstack" });
      }
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith(".") ||
        entry.name === "node_modules"
      )
        continue;
      if (entry.name === "codex") continue; // /codex is excluded from Codex output
      if (!fs.existsSync(path.join(ROOT, entry.name, "SKILL.md.tmpl")))
        continue;
      const codexName = entry.name.startsWith("mstack-")
        ? entry.name
        : `mstack-${entry.name}`;
      if (isSymlinkLoop(codexName)) continue;
      skills.push({ dir: entry.name, codexName });
    }
    return skills;
  })();

  test("--host codex generates correct output paths", () => {
    for (const skill of CODEX_SKILLS) {
      const skillMd = path.join(AGENTS_DIR, skill.codexName, "SKILL.md");
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test("root mstack bundle has OpenAI metadata for Codex skill browsing", () => {
    const rootMetadata = path.join(ROOT, "agents", "openai.yaml");
    expect(fs.existsSync(rootMetadata)).toBe(true);
    const content = fs.readFileSync(rootMetadata, "utf-8");
    expect(content).toContain('display_name: "mstack"');
    expect(content).toContain(
      "Use $mstack to locate the bundled mstack skills.",
    );
    expect(content).toContain("allow_implicit_invocation: true");
  });

  test("externalSkillName mapping: root is mstack, others are mstack-{dir}", () => {
    // Root → mstack
    expect(fs.existsSync(path.join(AGENTS_DIR, "mstack", "SKILL.md"))).toBe(
      true,
    );
    // Subdirectories → mstack-{dir}
    expect(
      fs.existsSync(path.join(AGENTS_DIR, "mstack-review", "SKILL.md")),
    ).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, "mstack-qa", "SKILL.md"))).toBe(
      true,
    );
  });

  test("Codex frontmatter has ONLY name + description", () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skill.codexName, "SKILL.md"),
        "utf-8",
      );
      expect(content.startsWith("---\n")).toBe(true);
      const fmEnd = content.indexOf("\n---", 4);
      expect(fmEnd).toBeGreaterThan(0);
      const frontmatter = content.slice(4, fmEnd);
      // Must have name and description
      expect(frontmatter).toContain("name:");
      expect(frontmatter).toContain("description:");
      // Must NOT have allowed-tools, version, or hooks
      expect(frontmatter).not.toContain("allowed-tools:");
      expect(frontmatter).not.toContain("version:");
      expect(frontmatter).not.toContain("hooks:");
    }
  });

  test("all Codex skills have agents/openai.yaml metadata", () => {
    for (const skill of CODEX_SKILLS) {
      const metadata = path.join(
        AGENTS_DIR,
        skill.codexName,
        "agents",
        "openai.yaml",
      );
      expect(fs.existsSync(metadata)).toBe(true);
      const content = fs.readFileSync(metadata, "utf-8");
      expect(content).toContain(`display_name: "${skill.codexName}"`);
      expect(content).toContain("short_description:");
      expect(content).toContain("allow_implicit_invocation: true");
    }
  });

  test("no .claude/skills/ in Codex output", () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skill.codexName, "SKILL.md"),
        "utf-8",
      );
      expect(content).not.toContain(".claude/skills");
    }
  });

  test("no ~/.claude/ paths in Codex output", () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skill.codexName, "SKILL.md"),
        "utf-8",
      );
      expect(content).not.toContain("~/.claude/");
    }
  });

  test("/codex skill excluded from Codex output", () => {
    expect(
      fs.existsSync(path.join(AGENTS_DIR, "mstack-codex", "SKILL.md")),
    ).toBe(false);
    expect(fs.existsSync(path.join(AGENTS_DIR, "mstack-codex"))).toBe(false);
  });

  test("Codex output includes Claude outside-voice skill with read-only boundary", () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-claude", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("claude -p");
    expect(content).toContain("mktemp /tmp/mstack-claude-prompt-");
    expect(content).toContain("mktemp /tmp/mstack-claude-diff-");
    expect(content).not.toContain("/tmp/mstack-claude-diff-$$");
    expect(content).toContain('cat "$PROMPT_FILE" | claude -p');
    expect(content).toContain("--disable-slash-commands");
    expect(content).toContain('--tools ""');
    expect(content).toContain("--allowedTools Read,Grep,Glob");
    expect(content).toContain("--disallowedTools Bash,Edit,Write");
    expect(content).toContain("is_error");
  });

  test("Codex review step stripped from Codex-host review", () => {
    const reviewContent = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );
    expect(reviewContent).not.toContain("codex review --base");
    expect(reviewContent).not.toContain("CODEX_REVIEWS");
  });

  test("--host codex --dry-run freshness", () => {
    const result = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "codex",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every Codex skill should be FRESH
    for (const skill of CODEX_SKILLS) {
      expect(output).toContain(
        `FRESH: .agents/skills/${skill.codexName}/SKILL.md`,
      );
    }
    expect(output).not.toContain("STALE");
  });

  test("--host agents alias produces same output as --host codex", () => {
    const codexResult = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "codex",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const agentsResult = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "agents",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(codexResult.exitCode).toBe(0);
    expect(agentsResult.exitCode).toBe(0);
    // Both should produce the same output (same FRESH lines)
    expect(codexResult.stdout.toString()).toBe(agentsResult.stdout.toString());
  });

  test("multiline descriptions preserved in Codex output", () => {
    // office-hours has a multiline description — verify it survives the frontmatter transform
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-office-hours", "SKILL.md"),
      "utf-8",
    );
    const fmEnd = content.indexOf("\n---", 4);
    const frontmatter = content.slice(4, fmEnd);
    // Description should span multiple lines (block scalar)
    const descLines = frontmatter.split("\n").filter((l) => l.startsWith("  "));
    expect(descLines.length).toBeGreaterThan(1);
    // Verify key phrases survived
    expect(frontmatter).toContain("YC Office Hours");
  });

  test("hook skills have safety prose and no hooks: in frontmatter", () => {
    const HOOK_SKILLS = ["mstack-guard"];
    for (const skillName of HOOK_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skillName, "SKILL.md"),
        "utf-8",
      );
      // Must have safety advisory prose
      expect(content).toContain("Safety Advisory");
      // Must NOT have hooks: in frontmatter
      const fmEnd = content.indexOf("\n---", 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain("hooks:");
    }
  });

  test("all Codex SKILL.md files have auto-generated header", () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skill.codexName, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("AUTO-GENERATED from SKILL.md.tmpl");
      expect(content).toContain("Regenerate: bun run gen:skill-docs");
    }
  });

  test("Codex preamble resolves runtime assets from repo-local or global mstack roots", () => {
    // Check a skill that has a preamble (review is a good candidate)
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("MSTACK_ROOT");
    expect(content).toContain("$_ROOT/.agents/skills/mstack");
    expect(content).toContain("$MSTACK_BIN/mstack-config");
    expect(content).not.toContain("mstack-upgrade/SKILL.md");
    expect(content).not.toContain(
      "~/.codex/skills/mstack/bin/mstack-config get telemetry",
    );
  });

  // ─── Path rewriting regression tests ─────────────────────────

  test("sidecar paths point to .agents/skills/mstack/review/ (not mstack-review/)", () => {
    // Regression: gen-skill-docs rewrote .claude/skills/review → .agents/skills/mstack-review
    // but setup puts sidecars under .agents/skills/mstack/review/. Must match setup layout.
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );
    // Correct: references to sidecar files use mstack/review/ path
    expect(content).toContain(".agents/skills/mstack/review/checklist.md");
    // design-checklist.md is now referenced via Review Army specialist (Claude only, stripped for Codex)
    // Wrong: must NOT reference mstack-review/checklist.md (file doesn't exist there)
    expect(content).not.toContain(".agents/skills/mstack-review/checklist.md");
  });

  test("greptile-triage sidecar path is correct", () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );
    if (content.includes("greptile-triage")) {
      expect(content).toContain(
        ".agents/skills/mstack/review/greptile-triage.md",
      );
      expect(content).not.toContain(
        ".agents/skills/mstack-review/greptile-triage",
      );
    }
  });

  test("all four path rewrite rules produce correct output", () => {
    // Test each of the 4 path rewrite rules individually
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );

    // Rule 1: ~/.claude/skills/mstack → $MSTACK_ROOT
    expect(content).not.toContain("~/.claude/skills/mstack");
    expect(content).toContain("$MSTACK_ROOT");

    // Rule 2: .claude/skills/mstack → .agents/skills/mstack
    expect(content).not.toContain(".claude/skills/mstack");

    // Rule 3: .claude/skills/review → .agents/skills/mstack/review
    expect(content).not.toContain(".claude/skills/review");

    // Rule 4: .claude/skills → .agents/skills (catch-all)
    expect(content).not.toContain(".claude/skills");
  });

  test("path rewrite rules apply to all Codex skills with sidecar references", () => {
    // Verify across ALL generated skills, not just review
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(
        path.join(AGENTS_DIR, skill.codexName, "SKILL.md"),
        "utf-8",
      );
      // No skill should reference Claude paths
      expect(content).not.toContain("~/.claude/skills");
      expect(content).not.toContain(".claude/skills");
      if (content.includes("mstack-config")) {
        expect(content).toContain("$MSTACK_ROOT");
      }
      // If a skill references checklist.md, it must use the correct sidecar path
      if (
        content.includes("checklist.md") &&
        !content.includes("design-checklist.md")
      ) {
        expect(content).not.toContain("mstack-review/checklist.md");
      }
    }
  });

  // ─── Claude output regression guard ─────────────────────────

  test("Claude output unchanged: review skill still uses .claude/skills/ paths", () => {
    // Codex changes must NOT affect Claude output
    const content = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain(".claude/skills/review/checklist.md");
    expect(content).toContain("~/.claude/skills/mstack");
    // Must NOT contain Codex paths
    expect(content).not.toContain(".agents/skills");
    expect(content).not.toContain("~/.codex/");
  });

  test("Claude output unchanged: all Claude skills have zero Codex paths", () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(
        path.join(ROOT, skill.dir, "SKILL.md"),
        "utf-8",
      );
      // autoplan documents the Codex CLI auth file (~/.codex/auth.json)
      // and log path (~/.codex/logs/) — those are user-facing Codex CLI paths,
      // not the mstack Codex host install path.
      if (skill.dir !== "autoplan") {
        expect(content).not.toContain("~/.codex/");
      }
      expect(content).not.toContain(".agents/skills");
    }
  });

  // ─── Design outside voices: Codex host guard ─────────────────

  test("codex host produces empty outside voices in design-review", () => {
    const codexContent = fs.readFileSync(
      path.join(AGENTS_DIR, "mstack-design-review", "SKILL.md"),
      "utf-8",
    );
    expect(codexContent).not.toContain("Design Outside Voices");
  });
});

// ─── Factory generation tests ────────────────────────────────

describe("Factory generation (--host factory)", () => {
  const FACTORY_DIR = path.join(ROOT, ".factory", "skills");

  // Generate Factory output for tests
  Bun.spawnSync(
    ["bun", "run", "scripts/gen-skill-docs.ts", "--host", "factory"],
    {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const FACTORY_SKILLS = (() => {
    const skills: Array<{ dir: string; factoryName: string }> = [];
    const isSymlinkLoop = (name: string): boolean => {
      const factorySkillDir = path.join(ROOT, ".factory", "skills", name);
      try {
        return fs.realpathSync(factorySkillDir) === fs.realpathSync(ROOT);
      } catch {
        return false;
      }
    };
    if (fs.existsSync(path.join(ROOT, "SKILL.md.tmpl"))) {
      if (!isSymlinkLoop("mstack"))
        skills.push({ dir: ".", factoryName: "mstack" });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith(".") ||
        entry.name === "node_modules"
      )
        continue;
      if (entry.name === "codex") continue;
      if (!fs.existsSync(path.join(ROOT, entry.name, "SKILL.md.tmpl")))
        continue;
      const factoryName = entry.name.startsWith("mstack-")
        ? entry.name
        : `mstack-${entry.name}`;
      if (isSymlinkLoop(factoryName)) continue;
      skills.push({ dir: entry.name, factoryName });
    }
    return skills;
  })();

  test("--host factory generates correct output paths", () => {
    for (const skill of FACTORY_SKILLS) {
      const skillMd = path.join(FACTORY_DIR, skill.factoryName, "SKILL.md");
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test("Factory frontmatter has name + description + user-invocable", () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(
        path.join(FACTORY_DIR, skill.factoryName, "SKILL.md"),
        "utf-8",
      );
      const fmEnd = content.indexOf("\n---", 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain("name:");
      expect(frontmatter).toContain("description:");
      expect(frontmatter).toContain("user-invocable: true");
      expect(frontmatter).not.toContain("allowed-tools:");
      expect(frontmatter).not.toContain("preamble-tier:");
      expect(frontmatter).not.toContain("sensitive:");
    }
  });

  test("sensitive skills have disable-model-invocation", () => {
    const SENSITIVE = ["mstack-guard"];
    for (const name of SENSITIVE) {
      const content = fs.readFileSync(
        path.join(FACTORY_DIR, name, "SKILL.md"),
        "utf-8",
      );
      const fmEnd = content.indexOf("\n---", 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain("disable-model-invocation: true");
    }
  });

  test("non-sensitive skills lack disable-model-invocation", () => {
    const NON_SENSITIVE = [
      "mstack-qa",
      "mstack-review",
      "mstack-investigate",
      "mstack-browse",
    ];
    for (const name of NON_SENSITIVE) {
      const content = fs.readFileSync(
        path.join(FACTORY_DIR, name, "SKILL.md"),
        "utf-8",
      );
      const fmEnd = content.indexOf("\n---", 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain("disable-model-invocation");
    }
  });

  test("no .claude/skills/ in Factory output", () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(
        path.join(FACTORY_DIR, skill.factoryName, "SKILL.md"),
        "utf-8",
      );
      expect(content).not.toContain(".claude/skills");
    }
  });

  test("no ~/.claude/skills/ paths in Factory output", () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(
        path.join(FACTORY_DIR, skill.factoryName, "SKILL.md"),
        "utf-8",
      );
      // ~/.claude/skills should be rewritten, but ~/.claude/plans is legitimate
      // (plan directory lookup) and ~/.claude/ in codex prompts is intentional
      expect(content).not.toContain("~/.claude/skills");
    }
  });

  test("/codex skill excluded from Factory output", () => {
    expect(
      fs.existsSync(path.join(FACTORY_DIR, "mstack-codex", "SKILL.md")),
    ).toBe(false);
    expect(fs.existsSync(path.join(FACTORY_DIR, "mstack-codex"))).toBe(false);
  });

  test("no agents/openai.yaml in Factory output", () => {
    for (const skill of FACTORY_SKILLS) {
      const yamlPath = path.join(
        FACTORY_DIR,
        skill.factoryName,
        "agents",
        "openai.yaml",
      );
      expect(fs.existsSync(yamlPath)).toBe(false);
    }
  });

  test("--host droid alias works", () => {
    const factoryResult = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "factory",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const droidResult = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "droid",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(factoryResult.exitCode).toBe(0);
    expect(droidResult.exitCode).toBe(0);
    expect(factoryResult.stdout.toString()).toBe(droidResult.stdout.toString());
  });

  test("--host factory --dry-run freshness", () => {
    const result = Bun.spawnSync(
      [
        "bun",
        "run",
        "scripts/gen-skill-docs.ts",
        "--host",
        "factory",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    for (const skill of FACTORY_SKILLS) {
      expect(output).toContain(
        `FRESH: .factory/skills/${skill.factoryName}/SKILL.md`,
      );
    }
    expect(output).not.toContain("STALE");
  });

  test("Factory preamble uses .factory paths", () => {
    const content = fs.readFileSync(
      path.join(FACTORY_DIR, "mstack-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("MSTACK_ROOT");
    expect(content).toContain("$_ROOT/.factory/skills/mstack");
    expect(content).toContain("$MSTACK_BIN/mstack-config");
  });
});

// ─── Parameterized host smoke tests (config-driven) ─────────

import { ALL_HOST_CONFIGS, getExternalHosts } from "../hosts/index";

describe("Parameterized host smoke tests", () => {
  for (const hostConfig of getExternalHosts()) {
    describe(`${hostConfig.displayName} (--host ${hostConfig.name})`, () => {
      const hostDir = path.join(ROOT, hostConfig.hostSubdir, "skills");

      test("generates output that exists on disk", () => {
        // Generated dir should exist (created by earlier bun run gen:skill-docs --host all)
        if (!fs.existsSync(hostDir)) {
          // Generate if not already done
          Bun.spawnSync(
            [
              "bun",
              "run",
              "scripts/gen-skill-docs.ts",
              "--host",
              hostConfig.name,
            ],
            {
              cwd: ROOT,
              stdout: "pipe",
              stderr: "pipe",
            },
          );
        }
        expect(fs.existsSync(hostDir)).toBe(true);
        const skills = fs
          .readdirSync(hostDir)
          .filter((d) => fs.existsSync(path.join(hostDir, d, "SKILL.md")));
        expect(skills.length).toBeGreaterThan(0);
      });

      test("no .claude/skills path leakage outside repo-root sidecar symlinks", () => {
        if (!fs.existsSync(hostDir)) return; // skip if not generated
        const skills = fs.readdirSync(hostDir);
        for (const skill of skills) {
          // Dev installs may mount the repo root at host/skills/mstack as a runtime
          // sidecar. The generator skips that symlink loop, so leakage checks should too.
          if (isRepoRootSymlink(path.join(hostDir, skill))) continue;
          const skillMd = path.join(hostDir, skill, "SKILL.md");
          if (!fs.existsSync(skillMd)) continue;
          const content = fs.readFileSync(skillMd, "utf-8");
          // Strip bash blocks (which have legitimate fallback paths)
          const noBash = content.replace(/```bash\n[\s\S]*?```/g, "");
          const leaks = noBash
            .split("\n")
            .filter((l) => l.includes(".claude/skills"));
          if (leaks.length > 0) {
            throw new Error(
              `${skill}: .claude/skills leakage:\n${leaks.slice(0, 3).join("\n")}`,
            );
          }
        }
      });

      test("frontmatter has name and description", () => {
        if (!fs.existsSync(hostDir)) return;
        const skills = fs.readdirSync(hostDir);
        for (const skill of skills) {
          const skillMd = path.join(hostDir, skill, "SKILL.md");
          if (!fs.existsSync(skillMd)) continue;
          const content = fs.readFileSync(skillMd, "utf-8");
          expect(content).toMatch(/^---\n/);
          expect(content).toMatch(/^name:\s/m);
          expect(content).toMatch(/^description:\s/m);
        }
      });

      test("generates Claude outside-voice skill for external hosts", () => {
        const skillMd = path.join(hostDir, "mstack-claude", "SKILL.md");
        expect(fs.existsSync(skillMd)).toBe(true);
        const content = fs.readFileSync(skillMd, "utf-8");
        expect(content).toContain("claude -p");
        expect(content).toContain("--disable-slash-commands");
        expect(content).toContain("--allowedTools Read,Grep,Glob");
        expect(content).toContain("--disallowedTools Bash,Edit,Write");
      });

      test("--dry-run freshness check passes", () => {
        const result = Bun.spawnSync(
          [
            "bun",
            "run",
            "scripts/gen-skill-docs.ts",
            "--host",
            hostConfig.name,
            "--dry-run",
          ],
          { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
        );
        expect(result.exitCode).toBe(0);
        const output = result.stdout.toString();
        expect(output).not.toContain("STALE");
      });

      if (hostConfig.generation.skipSkills?.includes("codex")) {
        test("/codex skill excluded", () => {
          expect(
            fs.existsSync(path.join(hostDir, "mstack-codex", "SKILL.md")),
          ).toBe(false);
        });
      }
    });
  }
});

// ─── --host all tests ────────────────────────────────────────

describe("--host all", () => {
  test("--host all generates for all registered hosts", () => {
    const result = Bun.spawnSync(
      ["bun", "run", "scripts/gen-skill-docs.ts", "--host", "all", "--dry-run"],
      {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // All hosts should appear in output
    expect(output).toContain("FRESH: SKILL.md"); // claude
    for (const hostConfig of getExternalHosts()) {
      expect(output).toContain(`FRESH: ${hostConfig.hostSubdir}/skills/`);
    }
  });
});

// ─── Setup script validation ─────────────────────────────────
// These tests verify the setup script's install layout matches
// what the generator produces — catching the bug where setup
// installed Claude-format source dirs for Codex users.

describe("setup script validation", () => {
  const setupContent = fs.readFileSync(path.join(ROOT, "setup"), "utf-8");

  test("setup has separate link functions for Claude and Codex", () => {
    expect(setupContent).toContain("link_claude_skill_dirs");
    expect(setupContent).toContain("link_codex_skill_dirs");
    // Old unified function must not exist
    expect(setupContent).not.toMatch(/^link_skill_dirs\(\)/m);
  });

  test("Claude install uses link_claude_skill_dirs", () => {
    // The Claude install section (section 4) should use the Claude function
    const claudeSection = setupContent.slice(
      setupContent.indexOf("# 4. Install for Claude"),
      setupContent.indexOf("# 5. Install for Codex"),
    );
    expect(claudeSection).toContain("link_claude_skill_dirs");
    expect(claudeSection).not.toContain("link_codex_skill_dirs");
  });

  test("Codex install uses link_codex_skill_dirs", () => {
    // The Codex install section (section 5) should use the Codex function
    const codexSection = setupContent.slice(
      setupContent.indexOf("# 5. Install for Codex"),
      setupContent.indexOf("# 6. Create"),
    );
    expect(codexSection).toContain("create_codex_runtime_root");
    expect(codexSection).toContain("link_codex_skill_dirs");
    expect(codexSection).not.toContain("link_claude_skill_dirs");
    expect(codexSection).not.toContain(
      '_link_or_copy "$MSTACK_DIR" "$CODEX_MSTACK"',
    );
  });

  test("Codex install prefers repo-local .agents/skills when setup runs from there", () => {
    expect(setupContent).toContain("SKILLS_PARENT_BASENAME");
    expect(setupContent).toContain("CODEX_REPO_LOCAL=0");
    expect(setupContent).toContain('[ "$SKILLS_PARENT_BASENAME" = ".agents" ]');
    expect(setupContent).toContain("CODEX_REPO_LOCAL=1");
    expect(setupContent).toContain('CODEX_SKILLS="$INSTALL_SKILLS_DIR"');
  });

  test("setup separates install path from source path for symlinked repo-local installs", () => {
    expect(setupContent).toContain("INSTALL_MSTACK_DIR=");
    expect(setupContent).toContain("SOURCE_MSTACK_DIR=");
    expect(setupContent).toContain("INSTALL_SKILLS_DIR=");
    expect(setupContent).toContain('CODEX_MSTACK="$INSTALL_MSTACK_DIR"');
    expect(setupContent).toContain(
      'link_codex_skill_dirs "$SOURCE_MSTACK_DIR" "$CODEX_SKILLS"',
    );
  });

  test("Codex installs always create sidecar runtime assets for the real skill target", () => {
    expect(setupContent).toContain('if [ "$INSTALL_CODEX" -eq 1 ]; then');
    expect(setupContent).toContain(
      'create_agents_sidecar "$SOURCE_MSTACK_DIR"',
    );
  });

  test("link_codex_skill_dirs reads from .agents/skills/", () => {
    // The Codex link function must reference .agents/skills for generated Codex skills
    const fnStart = setupContent.indexOf("link_codex_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("linked[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain(".agents/skills");
    expect(fnBody).toContain("mstack*");
  });

  test("link_claude_skill_dirs creates real directories with absolute SKILL.md symlinks", () => {
    // Claude links should be real directories with absolute SKILL.md symlinks
    // to ensure Claude Code discovers them as top-level skills (not nested under mstack/)
    const fnStart = setupContent.indexOf("link_claude_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("linked[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('mkdir -p "$target"');
    // v1.36.0.0: routes through _link_or_copy helper for Windows fallback (cp on MSYS2/Git Bash).
    expect(fnBody).toContain(
      '_link_or_copy "$mstack_dir/$dir_name/SKILL.md" "$target/SKILL.md"',
    );
  });

  // REGRESSION: cleanup functions must handle both old symlinks AND new real-directory pattern
  test("cleanup functions handle real directories with symlinked SKILL.md", () => {
    // cleanup_old_claude_symlinks must detect and remove real dirs with SKILL.md symlinks
    const cleanupOldStart = setupContent.indexOf(
      "cleanup_old_claude_symlinks()",
    );
    const cleanupOldEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("cleaned up old", cleanupOldStart),
    );
    const cleanupOldBody = setupContent.slice(cleanupOldStart, cleanupOldEnd);
    expect(cleanupOldBody).toContain('-d "$old_target"');
    expect(cleanupOldBody).toContain('-L "$old_target/SKILL.md"');
    expect(cleanupOldBody).toContain('rm -rf "$old_target"');

    // cleanup_prefixed_claude_symlinks must also handle the new pattern
    const cleanupPrefixedStart = setupContent.indexOf(
      "cleanup_prefixed_claude_symlinks()",
    );
    const cleanupPrefixedEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("cleaned up prefixed", cleanupPrefixedStart),
    );
    const cleanupPrefixedBody = setupContent.slice(
      cleanupPrefixedStart,
      cleanupPrefixedEnd,
    );
    expect(cleanupPrefixedBody).toContain('-d "$prefixed_target"');
    expect(cleanupPrefixedBody).toContain('-L "$prefixed_target/SKILL.md"');
    expect(cleanupPrefixedBody).toContain('rm -rf "$prefixed_target"');
  });

  // REGRESSION: link function must upgrade old directory symlinks
  test("link_claude_skill_dirs removes old directory symlinks before creating real dirs", () => {
    const fnStart = setupContent.indexOf("link_claude_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("linked[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // Must check for and remove old symlinks before mkdir
    expect(fnBody).toContain('if [ -L "$target" ]');
    expect(fnBody).toContain('rm -f "$target"');
  });

  test("setup supports --host auto|claude|codex|kiro|opencode", () => {
    expect(setupContent).toContain("--host");
    expect(setupContent).toContain("claude|codex|kiro|factory|opencode|auto");
  });

  test("auto mode detects claude, codex, kiro, and opencode binaries", () => {
    expect(setupContent).toContain("command -v claude");
    expect(setupContent).toContain("command -v codex");
    expect(setupContent).toContain("command -v kiro-cli");
    expect(setupContent).toContain("command -v opencode");
  });

  // T1: Sidecar skip guard — prevents .agents/skills/mstack from being linked as a skill
  test("link_codex_skill_dirs skips the mstack sidecar directory", () => {
    const fnStart = setupContent.indexOf("link_codex_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("done", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('[ "$skill_name" = "mstack" ] && continue');
  });

  // T2: Dynamic $MSTACK_ROOT paths in generated Codex preambles
  test("generated Codex preambles use dynamic MSTACK_ROOT paths", () => {
    const codexSkillDir = path.join(ROOT, ".agents", "skills", "mstack-review");
    if (!fs.existsSync(codexSkillDir)) return; // skip if .agents/ not generated
    const content = fs.readFileSync(
      path.join(codexSkillDir, "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("MSTACK_ROOT=");
    expect(content).toContain("$MSTACK_BIN/");
  });

  test("setup supports --host kiro with install section and sed rewrites", () => {
    expect(setupContent).toContain("INSTALL_KIRO=");
    expect(setupContent).toContain("kiro-cli");
    expect(setupContent).toContain("KIRO_SKILLS=");
    expect(setupContent).toContain("~/.kiro/skills/mstack");
  });

  test("setup supports --host opencode with install section and OpenCode skill path vars", () => {
    expect(setupContent).toContain("INSTALL_OPENCODE=");
    expect(setupContent).toContain(
      'OPENCODE_SKILLS="$HOME/.config/opencode/skills"',
    );
    expect(setupContent).toContain('OPENCODE_MSTACK="$OPENCODE_SKILLS/mstack"');
  });

  test("setup installs OpenCode skills into a nested mstack runtime root", () => {
    expect(setupContent).toContain("create_opencode_runtime_root");
    expect(setupContent).toContain(".opencode/skills");
    expect(setupContent).toContain("review/specialists");
    expect(setupContent).toContain("qa/templates");
    expect(setupContent).toContain("qa/references");
    expect(setupContent).toContain("dx-hall-of-fame.md");
  });

  test("create_agents_sidecar links runtime assets", () => {
    // Sidecar must link bin, browse, review, qa
    const fnStart = setupContent.indexOf("create_agents_sidecar()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("done", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("bin");
    expect(fnBody).toContain("browse");
    expect(fnBody).toContain("review");
    expect(fnBody).toContain("qa");
  });

  test("create_codex_runtime_root exposes only runtime assets", () => {
    const fnStart = setupContent.indexOf("create_codex_runtime_root()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("done", setupContent.indexOf("review/", fnStart)),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("mstack/SKILL.md");
    expect(fnBody).toContain("browse/dist");
    expect(fnBody).toContain("browse/bin");
    expect(fnBody).toContain("mstack-upgrade/SKILL.md");
    // Review runtime assets (individual files, not the whole dir)
    expect(fnBody).toContain("checklist.md");
    expect(fnBody).toContain("design-checklist.md");
    expect(fnBody).toContain("greptile-triage.md");
    expect(fnBody).toContain("TODOS-format.md");
    expect(fnBody).not.toContain('_link_or_copy "$mstack_dir" "$codex_mstack"');
  });

  test("direct Codex installs are migrated out of ~/.codex/skills/mstack", () => {
    expect(setupContent).toContain("migrate_direct_codex_install");
    expect(setupContent).toContain("$HOME/.mstack/repos/mstack");
    expect(setupContent).toContain("avoid duplicate skill discovery");
  });

  // --- Symlink prefix tests (PR #503) ---

  test("link_claude_skill_dirs applies mstack- prefix by default", () => {
    const fnStart = setupContent.indexOf("link_claude_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("linked[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("SKILL_PREFIX");
    expect(fnBody).toContain('link_name="mstack-$skill_name"');
  });

  test("link_claude_skill_dirs preserves already-prefixed dirs", () => {
    const fnStart = setupContent.indexOf("link_claude_skill_dirs()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("linked[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // mstack-* dirs should keep their name (e.g., mstack-upgrade stays mstack-upgrade)
    expect(fnBody).toContain('mstack-*) link_name="$skill_name"');
  });

  test("setup supports --no-prefix flag", () => {
    expect(setupContent).toContain("--no-prefix");
    expect(setupContent).toContain("SKILL_PREFIX=0");
  });

  test("cleanup_old_claude_symlinks removes only mstack-pointing symlinks", () => {
    expect(setupContent).toContain("cleanup_old_claude_symlinks");
    const fnStart = setupContent.indexOf("cleanup_old_claude_symlinks()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("removed[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // Should check readlink before removing
    expect(fnBody).toContain("readlink");
    expect(fnBody).toContain("mstack/*");
    // Should skip already-prefixed dirs
    expect(fnBody).toContain("mstack-*) continue");
  });

  test("cleanup runs before link when prefix is enabled", () => {
    // In the Claude install section, cleanup should happen before linking
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf("INSTALL_CLAUDE"),
      setupContent.lastIndexOf("link_claude_skill_dirs"),
    );
    expect(claudeInstallSection).toContain("cleanup_old_claude_symlinks");
  });

  // --- Persistent config + interactive prompt tests ---

  test("setup reads skill_prefix from config", () => {
    expect(setupContent).toContain("get skill_prefix");
    expect(setupContent).toContain("MSTACK_CONFIG");
  });

  test("setup supports --prefix flag", () => {
    expect(setupContent).toContain("--prefix)");
    expect(setupContent).toContain("SKILL_PREFIX=1; SKILL_PREFIX_FLAG=1");
  });

  test("--prefix and --no-prefix persist to config", () => {
    expect(setupContent).toContain("set skill_prefix");
  });

  test("interactive prompt shows when no config", () => {
    expect(setupContent).toContain("Short names");
    expect(setupContent).toContain("Namespaced");
    expect(setupContent).toContain("Choice [1/2]");
  });

  test("non-TTY defaults to flat names", () => {
    // Should check if stdin is a TTY before prompting
    expect(setupContent).toContain("-t 0");
  });

  test("cleanup_prefixed_claude_symlinks exists and uses readlink", () => {
    expect(setupContent).toContain("cleanup_prefixed_claude_symlinks");
    const fnStart = setupContent.indexOf("cleanup_prefixed_claude_symlinks()");
    const fnEnd = setupContent.indexOf(
      "}",
      setupContent.indexOf("removed[@]}", fnStart),
    );
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("readlink");
    expect(fnBody).toContain("mstack-$skill_name");
  });

  test("reverse cleanup runs before link when prefix is disabled", () => {
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf("INSTALL_CLAUDE"),
      setupContent.lastIndexOf("link_claude_skill_dirs"),
    );
    expect(claudeInstallSection).toContain("cleanup_prefixed_claude_symlinks");
  });

  // welcome message SKILL_PREFIX test removed — "Run /mstack-upgrade anytime" removed in repo simplification
});

describe("discover-skills hidden directory filtering", () => {
  test("discoverTemplates skips dot-prefixed directories", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mstack-discover-"));
    try {
      // Create a hidden dir with a template (should be excluded)
      fs.mkdirSync(path.join(tmpDir, ".hidden"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".hidden", "SKILL.md.tmpl"),
        "---\nname: evil\n---\ntest",
      );
      // Create a visible dir with a template (should be included)
      fs.mkdirSync(path.join(tmpDir, "visible"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "visible", "SKILL.md.tmpl"),
        "---\nname: good\n---\ntest",
      );

      const { discoverTemplates } = require("../scripts/discover-skills");
      const results = discoverTemplates(tmpDir);
      const dirs = results.map((r: { tmpl: string }) => r.tmpl);

      expect(dirs).toContain("visible/SKILL.md.tmpl");
      expect(dirs).not.toContain(".hidden/SKILL.md.tmpl");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("community fixes wave", () => {
  // Helper to get all generated SKILL.md files
  function getAllSkillMds(): Array<{ name: string; content: string }> {
    const results: Array<{ name: string; content: string }> = [];
    const rootPath = path.join(ROOT, "SKILL.md");
    if (fs.existsSync(rootPath)) {
      results.push({
        name: "root",
        content: fs.readFileSync(rootPath, "utf-8"),
      });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith(".") ||
        entry.name === "node_modules"
      )
        continue;
      const skillPath = path.join(ROOT, entry.name, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        results.push({
          name: entry.name,
          content: fs.readFileSync(skillPath, "utf-8"),
        });
      }
    }
    return results;
  }

  // #594 — Discoverability: every SKILL.md.tmpl description contains "mstack"
  test('every SKILL.md.tmpl description contains "mstack"', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath =
        skill.dir === "."
          ? path.join(ROOT, "SKILL.md.tmpl")
          : path.join(ROOT, skill.dir, "SKILL.md.tmpl");
      const content = fs.readFileSync(tmplPath, "utf-8");
      const desc = extractDescription(content);
      expect(desc.toLowerCase()).toContain("mstack");
    }
  });

  // #594 — Discoverability: first line of each description is under 120 chars
  test("every SKILL.md.tmpl description first line is under 120 chars", () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath =
        skill.dir === "."
          ? path.join(ROOT, "SKILL.md.tmpl")
          : path.join(ROOT, skill.dir, "SKILL.md.tmpl");
      const content = fs.readFileSync(tmplPath, "utf-8");
      const desc = extractDescription(content);
      const firstLine = desc.split("\n")[0];
      expect(firstLine.length).toBeLessThanOrEqual(120);
    }
  });

  // #510 — Context warnings: no SKILL.md contains "running low on context"
  test('no generated SKILL.md contains "running low on context"', () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      expect(content).not.toContain("running low on context");
    }
  });

  // #510 — Context warnings: plan-eng-review has explicit anti-warning
  test('plan-eng-review/SKILL.md contains "Do not preemptively warn"', () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-eng-review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Do not preemptively warn");
  });

  // #474 — Safety Net: no SKILL.md uses find with -delete
  test("no generated SKILL.md contains find with -delete flag", () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      // Match find commands that use -delete (but not prose mentioning the word "delete")
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes("find ") && line.includes("-delete")) {
          throw new Error(
            `${name}/SKILL.md contains find with -delete: ${line.trim()}`,
          );
        }
      }
    }
  });
});

describe("codex commands must not use inline $(git rev-parse --show-toplevel) for cwd", () => {
  // Regression test: inline $(git rev-parse --show-toplevel) in codex exec -C
  // or codex review without cd evaluates in whatever cwd the background shell
  // inherits, which may be a different project in Conductor workspaces.
  // The fix is to resolve _REPO_ROOT eagerly at the top of each bash block.

  // Scan all source files that could contain codex commands
  // Use Bun.Glob to avoid ELOOP from .claude/skills/mstack symlink back to ROOT
  const tmplGlob = new Bun.Glob("**/*.tmpl");
  const sourceFiles = [
    ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
    ...fs
      .readdirSync(path.join(ROOT, "scripts/resolvers"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `scripts/resolvers/${f}`),
    "scripts/gen-skill-docs.ts",
  ];

  test("no codex exec command uses inline $(git rev-parse --show-toplevel) in -C flag", () => {
    const violations: string[] = [];
    for (const rel of sourceFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes("codex exec") &&
          line.includes("-C") &&
          line.includes("$(git rev-parse --show-toplevel)")
        ) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("no generated SKILL.md has codex exec with inline $(git rev-parse --show-toplevel) in -C flag", () => {
    const violations: string[] = [];
    const skillMdGlob = new Bun.Glob("**/SKILL.md");
    const skillMdFiles = Array.from(
      skillMdGlob.scanSync({ cwd: ROOT, followSymlinks: false }),
    );
    for (const rel of skillMdFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes("codex exec") &&
          line.includes("-C") &&
          line.includes("$(git rev-parse --show-toplevel)")
        ) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('codex review commands must be preceded by cd "$_REPO_ROOT" (no -C support)', () => {
    // codex review does not support -C, so the pattern must be:
    //   _REPO_ROOT=$(git rev-parse --show-toplevel) || { ... }
    //   cd "$_REPO_ROOT"
    //   codex review ...
    // NOT: codex review ... with inline $(git rev-parse --show-toplevel)
    const allFiles = [
      ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
      ...Array.from(
        new Bun.Glob("**/SKILL.md").scanSync({
          cwd: ROOT,
          followSymlinks: false,
        }),
      ),
      ...fs
        .readdirSync(path.join(ROOT, "scripts/resolvers"))
        .filter((f) => f.endsWith(".ts"))
        .map((f) => `scripts/resolvers/${f}`),
      "scripts/gen-skill-docs.ts",
    ];
    const violations: string[] = [];
    for (const rel of allFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip non-executable lines (markdown table cells, prose references)
        if (line.includes("|") && line.includes("`/codex review`")) continue;
        if (line.includes("`codex review`")) continue;
        // Check for codex review with inline $(git rev-parse)
        if (
          line.includes("codex review") &&
          line.includes("$(git rev-parse --show-toplevel)")
        ) {
          violations.push(
            `${rel}:${i + 1} — inline git rev-parse in codex review`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─── Confidence Resolver Tests ─────────────────────

describe("CONFIDENCE_CALIBRATION resolver", () => {
  const CONFIDENCE_SKILLS = ["review", "plan-eng-review", "cso"];

  for (const skill of CONFIDENCE_SKILLS) {
    test(`${skill} generated SKILL.md contains confidence calibration`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toContain("Confidence Calibration");
      expect(content).toContain("confidence score");
    });
  }

  test("confidence calibration includes scoring rubric with all tiers", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("9-10");
    expect(content).toContain("7-8");
    expect(content).toContain("5-6");
    expect(content).toContain("3-4");
    expect(content).toContain("1-2");
  });

  test("confidence calibration includes display rules", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Show normally");
    expect(content).toContain("Suppress from main report");
  });

  test("confidence calibration includes finding format example", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("[P1] (confidence:");
    expect(content).toContain("SQL injection");
  });

  test("confidence calibration includes calibration learning feedback loop", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "review", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("calibration event");
    expect(content).toContain("Log the corrected pattern");
  });

  test("skills without confidence calibration do NOT contain it", () => {
    // office-hours and retro do NOT use confidence calibration
    for (const skill of ["office-hours", "retro"]) {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).not.toContain("## Confidence Calibration");
    }
  });
});

describe("gen-skill-docs prefix warning (#620/#578)", () => {
  const { execSync } = require("child_process");

  test("warns about skill_prefix when config has prefix=true", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mstack-prefix-warn-"),
    );
    try {
      // Create a fake ~/.mstack/config.yaml with skill_prefix: true
      const fakeHome = tmpDir;
      const fakeGstack = path.join(fakeHome, ".mstack");
      fs.mkdirSync(fakeGstack, { recursive: true });
      fs.writeFileSync(
        path.join(fakeGstack, "config.yaml"),
        "skill_prefix: true\n",
      );

      const output = execSync("bun run scripts/gen-skill-docs.ts", {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: "utf-8",
        timeout: 30000,
      });
      expect(output).toContain("skill_prefix is true");
      expect(output).toContain("mstack-relink");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("no warning when skill_prefix is false or absent", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mstack-prefix-warn-"),
    );
    try {
      const fakeHome = tmpDir;
      const fakeGstack = path.join(fakeHome, ".mstack");
      fs.mkdirSync(fakeGstack, { recursive: true });
      fs.writeFileSync(
        path.join(fakeGstack, "config.yaml"),
        "skill_prefix: false\n",
      );

      const output = execSync("bun run scripts/gen-skill-docs.ts", {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: "utf-8",
        timeout: 30000,
      });
      expect(output).not.toContain("skill_prefix is true");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("voice-triggers processing", () => {
  const { extractVoiceTriggers, processVoiceTriggers } =
    require("../scripts/gen-skill-docs") as {
      extractVoiceTriggers: (content: string) => string[];
      processVoiceTriggers: (content: string) => string;
    };

  test("extractVoiceTriggers parses valid YAML list", () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit.\nvoice-triggers:\n  - "see-so"\n  - "security review"\n---\nBody`;
    const triggers = extractVoiceTriggers(content);
    expect(triggers).toEqual(["see-so", "security review"]);
  });

  test("extractVoiceTriggers returns [] when no field present", () => {
    const content = `---\nname: qa\ndescription: |\n  QA testing.\n---\nBody`;
    expect(extractVoiceTriggers(content)).toEqual([]);
  });

  test("processVoiceTriggers appends voice triggers to description", () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit. (mstack)\nvoice-triggers:\n  - "see-so"\n  - "security review"\n---\nBody`;
    const result = processVoiceTriggers(content);
    expect(result).toContain(
      'Voice triggers (speech-to-text aliases): "see-so", "security review".',
    );
  });

  test("processVoiceTriggers strips voice-triggers field from output", () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit. (mstack)\nvoice-triggers:\n  - "see-so"\n---\nBody`;
    const result = processVoiceTriggers(content);
    expect(result).not.toContain("voice-triggers:");
  });

  test("processVoiceTriggers returns content unchanged when no voice-triggers", () => {
    const content = `---\nname: qa\ndescription: |\n  QA testing.\n---\nBody`;
    expect(processVoiceTriggers(content)).toBe(content);
  });

  test("generated CSO SKILL.md contains voice triggers in description", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "cso", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain('"see-so"');
    expect(content).toContain("Voice triggers (speech-to-text aliases):");
  });

  test("generated CSO SKILL.md does NOT contain raw voice-triggers field", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "cso", "SKILL.md"),
      "utf-8",
    );
    const fmEnd = content.indexOf("\n---", 4);
    const frontmatter = content.slice(0, fmEnd);
    expect(frontmatter).not.toContain("voice-triggers:");
  });
});

describe("plan-mode-info resolver (handshake-replacement)", () => {
  const REVIEW_SKILLS = [
    "plan-ceo-review",
    "plan-eng-review",
    "plan-design-review",
  ];

  // Header for the vestigial handshake that was removed. If it ever reappears,
  // someone accidentally re-introduced the resolver.
  const HANDSHAKE_MARKER = "## Plan Mode Handshake";
  // Header for the new plan-mode-info section (previously lived at the tail
  // of completion-status.ts; now hoisted to position 1 of the preamble).
  const PLAN_MODE_INFO_MARKER = "## Skill Invocation During Plan Mode";

  test("vestigial handshake is absent from all generated Claude SKILL.md files", () => {
    // Scan every generated SKILL.md under ROOT (top-level directory per skill).
    // Using fs.readdirSync + filter instead of a glob so we catch any skill
    // that gets added later without updating this list.
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    let checked = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(ROOT, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      expect(
        content,
        `handshake marker in ${entry.name}/SKILL.md`,
      ).not.toContain(HANDSHAKE_MARKER);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test("vestigial handshake is absent from non-Claude host outputs when present on disk", () => {
    // Non-Claude hosts render to hostSubdirs (.agents/, .openclaw/, etc). The
    // plan-mode-info resolver has no host-scoping — all hosts get the new
    // section, none get the old handshake. Scan all candidate host dirs.
    const hostDirs = [
      ".agents",
      ".openclaw",
      ".opencode",
      ".factory",
      ".hermes",
      ".kiro",
      ".cursor",
      ".slate",
    ];
    let checked = 0;
    for (const host of hostDirs) {
      const skillsRoot = path.join(ROOT, host, "skills");
      if (!fs.existsSync(skillsRoot)) continue;
      const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsRoot, entry.name, "SKILL.md");
        if (!fs.existsSync(skillMd)) continue;
        const content = fs.readFileSync(skillMd, "utf-8");
        expect(
          content,
          `handshake marker in ${host}/skills/${entry.name}/SKILL.md`,
        ).not.toContain(HANDSHAKE_MARKER);
        checked++;
      }
    }
    if (checked === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "plan-mode-info: no non-Claude host outputs found for cross-host absence check — " +
          "run `bun run gen:skill-docs --host all` to populate",
      );
    }
  });

  test.each(REVIEW_SKILLS)(
    "%s/SKILL.md contains the new plan-mode-info section near the top",
    (skill) => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );
      const idx = content.indexOf(PLAN_MODE_INFO_MARKER);
      expect(idx).toBeGreaterThan(0);
      // Position 1 in preamble composition = within the first ~300 lines.
      // Roughly translates to first ~15KB of text.
      expect(idx).toBeLessThan(15_000);
    },
  );

  test("plan-mode-info is wired early in preamble (within first 15KB)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    const planModeIdx = content.indexOf(PLAN_MODE_INFO_MARKER);
    expect(planModeIdx).toBeGreaterThan(0);
    expect(planModeIdx).toBeLessThan(15_000);
  });

  test("0C-bis STOP block present in plan-ceo-review/SKILL.md", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "plan-ceo-review", "SKILL.md"),
      "utf-8",
    );
    const presentIdx = content.indexOf(
      "Present these approach options via AskUserQuestion",
    );
    const preludeIdx = content.indexOf("### 0D-prelude");
    expect(presentIdx).toBeGreaterThan(0);
    expect(preludeIdx).toBeGreaterThan(presentIdx);
    const between = content.slice(presentIdx, preludeIdx);
    expect(between).toContain("**STOP.**");
    expect(between).toContain(
      "Do NOT proceed to Step 0D or 0F until the user responds to 0C-bis",
    );
  });
});

// GSTACK REVIEW REPORT report-at-bottom contract — verifies the prompt-text
// fix in scripts/resolvers/review.ts (the load-bearing change for the
// "report not at bottom of plan in plan mode" bug). The bug is in the
// prompt's contradictory write-flow instructions, not in observable
// runtime behavior we can cheaply gate in CI. Verifying the prompt text
// directly is the deterministic equivalent of the regression test the
// PTY harness can't reliably drive (autoplan needs auto-progression of
// AskUserQuestions to reach the report-write step, which the harness
// doesn't support today).
describe("GSTACK REVIEW REPORT delete-then-append flow", () => {
  const PLAN_REVIEW_SKILLS = [
    "plan-ceo-review",
    "plan-design-review",
    "plan-eng-review",
  ];

  for (const skill of PLAN_REVIEW_SKILLS) {
    test(`${skill}/SKILL.md prescribes delete-then-append, not in-place replace`, () => {
      const content = fs.readFileSync(
        path.join(ROOT, skill, "SKILL.md"),
        "utf-8",
      );

      // The new (correct) instruction must be present.
      expect(content).toContain("delete-then-append flow");
      expect(content).toContain("never mid-file");
      expect(content).toContain("Do NOT replace the section in place");

      // The old contradictory bullets must be gone. The signature phrase
      // from the buggy prompt was 'replace it entirely using the Edit tool'
      // which is what allowed mid-file reports to stay mid-file.
      expect(content).not.toContain(
        "replace it** entirely using the Edit tool",
      );
      expect(content).not.toContain("If it was found mid-file, move it");
    });
  }

  test("scripts/resolvers/review.ts source has the rewritten flow", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "scripts", "resolvers", "review.ts"),
      "utf-8",
    );
    expect(src).toContain("delete-then-append flow");
    expect(src).toContain("never mid-file");
    expect(src).toContain("Do NOT replace the section in place");
    // Old contradictory bullets are gone from the source resolver.
    expect(src).not.toContain("replace it** entirely using the Edit tool");
    expect(src).not.toContain("If it was found mid-file, move it");
  });
});

describe("EXIT PLAN MODE GATE placement", () => {
  const planSkills = [
    "plan-eng-review",
    "plan-ceo-review",
    "plan-design-review",
  ];

  // Strip fenced code blocks before matching headings — PLAN_FILE_REVIEW_REPORT
  // already contains `## GSTACK REVIEW REPORT` inside a markdown example fence,
  // and the gate text itself shows `## GSTACK REVIEW REPORT` inside a fence too.
  const stripFences = (md: string) => md.replace(/```[\s\S]*?```/g, "");

  test("gate is the terminal ## heading in every plan-* review SKILL.md", () => {
    for (const skill of planSkills) {
      const md = fs.readFileSync(path.join(ROOT, skill, "SKILL.md"), "utf-8");
      const stripped = stripFences(md);
      const headings = [...stripped.matchAll(/^## .+$/gm)].map((m) => m[0]);
      const lastH2 = headings.at(-1);
      expect(
        lastH2,
        `${skill}/SKILL.md last ## heading (fences stripped)`,
      ).toBe("## EXIT PLAN MODE GATE (BLOCKING)");
      expect(md, `${skill}/SKILL.md gate body`).toContain(
        "Failing this gate and calling ExitPlanMode anyway is a contract violation",
      );
    }
  });
});
