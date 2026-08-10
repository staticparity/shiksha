/**
 * Permanent prompt-quality eval for the two-axis scoring change (T3e).
 *
 * Calls the REAL OpenAI API — costs real money, needs OPENAI_API_KEY. Gated
 * behind RUN_LIVE_EVALS so it's skipped (not just slow) during normal
 * `pnpm test` and CI runs. Run deliberately with:
 *
 *   pnpm test:evals
 *
 * Seeded from the manual verification run during /plan-eng-review
 * (2026-08-08) that confirmed understandingBand/explanationBand actually
 * diverge — see the design doc's Approach B / T3a notes. These 3 cases are
 * the worked examples from the source PDFs (AI_Feynman_Worked_Examples.pdf),
 * not synthetic — Session 1 (Secure), Session 2 (Articulate error), Session 3
 * (Encoding gap).
 */

import { describe, it, expect } from "vitest";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { buildWisdomPrompt, formatTranscript, MasteryResultSchema, WISDOM_MODEL, WISDOM_TEMPERATURE } from "./wisdom";

const RUN_LIVE_EVALS = process.env.RUN_LIVE_EVALS === "1";

const knowledgeBase = {
  key_concepts: [
    { concept: "Variation pre-exists", description: "Variation exists in a population before the selection pressure acts on it" },
    { concept: "Heritability", description: "Only heritable differences accumulate across generations" },
    { concept: "Differential reproduction", description: "Selection acts through reproduction, not survival alone" },
  ],
  common_misconceptions: [
    "Lamarckian — traits acquired during life are inherited",
    "Teleological — organisms change in order to meet a need",
  ],
  difficulty_level: "novice",
};

async function scoreTranscript(studentAnswer: string) {
  const transcript = [
    { role: "learner" as const, content: "Can you explain how natural selection works?" },
    { role: "student" as const, content: studentAnswer },
  ];
  const result = await generateObject({
    model: openai(WISDOM_MODEL),
    schema: MasteryResultSchema,
    system: buildWisdomPrompt("Natural Selection", knowledgeBase),
    prompt: `Evaluate this explanation session for the topic "Natural Selection" (Biology):\n\n${formatTranscript(transcript)}`,
    temperature: WISDOM_TEMPERATURE,
  });
  return result.object;
}

describe.skipIf(!RUN_LIVE_EVALS)("wisdom.ts two-axis scoring — live eval", () => {
  it(
    "Session 1 (Secure): correct and clear should NOT diverge, and should land in the top band",
    async () => {
      const result = await scoreTranscript(
        "Okay so natural selection. In any population, say beetles, they're not all identical. Some are darker, some lighter. That variation is just there already. Now if birds are eating them and the ground is dark, the lighter ones get spotted more and eaten more. So the darker ones survive more often and have more offspring. And since colour gets passed from parent to offspring, the next generation has a higher proportion of dark beetles. The thing people get wrong is thinking the beetles changed. Nothing decided anything."
      );
      expect(result.understandingBand).toBe("secure");
      expect(result.explanationBand).toBe("secure");
    },
    30_000
  );

  it(
    "Session 2 (Articulate error): fluent Lamarckian explanation must diverge — low understanding, high explanation",
    async () => {
      const result = await scoreTranscript(
        "So natural selection is about how animals adapt to their environment. Take giraffes, the classic example. They needed to reach leaves higher up in the trees, so over time they stretched their necks further and further. Those longer necks got passed down to their offspring, and each generation the necks got a bit longer, until you get the giraffes we have today. It's basically the environment shaping the species to fit it. Survival of the fittest — the ones best suited to the environment are the ones that make it through."
      );
      expect(result.understandingBand).not.toBe("secure");
      expect(result.explanationBand).toBe("secure");
      expect(result.understandingBand).not.toBe(result.explanationBand);
    },
    30_000
  );

  it(
    "Session 3 (Encoding gap): correct but jargon-dense must be penalized on explanationBand for audience fit",
    async () => {
      const result = await scoreTranscript(
        "Natural selection is the differential reproductive success of heritable phenotypic variants within a population, producing shifts in trait frequency across generations under a given selection pressure."
      );
      expect(result.explanationBand).not.toBe("secure");
    },
    30_000
  );
});
