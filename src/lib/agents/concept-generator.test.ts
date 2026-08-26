import { describe, it, expect } from "vitest";
import { isGrounded, buildConceptGeneratorPrompt, MAX_GENERATED_CONCEPTS } from "./concept-generator";

describe("isGrounded", () => {
  const content = `Chlorophyll absorbs light energy for the light reactions.
    It’s the pigment that makes leaves look green.`;

  it("matches an exact substring", () => {
    expect(isGrounded("Chlorophyll absorbs light energy", content)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isGrounded("CHLOROPHYLL ABSORBS LIGHT ENERGY", content)).toBe(true);
  });

  it("matches across whitespace/newline differences", () => {
    expect(isGrounded("light reactions. It's the pigment", content)).toBe(true);
  });

  it("matches through smart-quote differences", () => {
    // Source has a curly apostrophe; excerpt uses a straight one.
    expect(isGrounded("It's the pigment that makes leaves look green", content)).toBe(true);
  });

  it("returns false for a fabricated excerpt not in the source", () => {
    expect(isGrounded("Mitochondria is the powerhouse of the cell", content)).toBe(false);
  });

  it("returns false for an empty excerpt", () => {
    expect(isGrounded("", content)).toBe(false);
    expect(isGrounded("   ", content)).toBe(false);
  });
});

describe("buildConceptGeneratorPrompt", () => {
  it("embeds the pasted content verbatim", () => {
    const prompt = buildConceptGeneratorPrompt("Photosynthesis converts light into chemical energy.");
    expect(prompt).toContain("Photosynthesis converts light into chemical energy.");
  });

  it("states the concept cap", () => {
    const prompt = buildConceptGeneratorPrompt("some content");
    expect(prompt).toContain(String(MAX_GENERATED_CONCEPTS));
  });
});
