/**
 * Preamble composition order — gate-tier test.
 *
 * Asserts that AskUserQuestion Format is present in tier-≥2 preamble output
 * and absent from tier-1. Model-overlay ordering tests were removed when
 * model-overlays/ was deleted in the repo simplification.
 */
import { describe, test, expect } from "bun:test";
import type { TemplateContext } from "../scripts/resolvers/types";
import { HOST_PATHS } from "../scripts/resolvers/types";
import { generatePreamble } from "../scripts/resolvers/preamble";

function makeCtx(
  host: "claude" | "codex",
  tier: 1 | 2 | 3 | 4,
  model?: string,
): TemplateContext {
  return {
    skillName: "test-skill",
    tmplPath: "test.tmpl",
    host,
    paths: HOST_PATHS[host],
    preambleTier: tier,
    ...(model ? { model } : {}),
  };
}

describe("Preamble composition order", () => {
  test("AskUserQuestion Format is present in tier 2 (claude host)", () => {
    const out = generatePreamble(makeCtx("claude", 2));
    expect(out).toContain("## AskUserQuestion Format");
  });

  test("AskUserQuestion Format is present in tier 3 (claude host)", () => {
    const out = generatePreamble(makeCtx("claude", 3));
    expect(out).toContain("## AskUserQuestion Format");
  });

  test("AskUserQuestion Format is present in tier 2 (codex host)", () => {
    const out = generatePreamble(makeCtx("codex", 2));
    expect(out).toContain("## AskUserQuestion Format");
  });

  test("tier 1 preamble does NOT include AskUserQuestion Format", () => {
    const out = generatePreamble(makeCtx("claude", 1));
    expect(out).not.toContain("## AskUserQuestion Format");
  });
});
