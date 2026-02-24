import { describe, it, expect } from "vitest";
import EntriesValidator from "../performance/EntriesValidator";
import { EntriesEnum } from "../performance/enums/EntriesEnum";

describe("EntriesValidator", () => {
  it("validates when at least one entry type is present", () => {
    const validator = new EntriesValidator({
      [EntriesEnum.RESOURCE]: [{ name: "https://example.com/script.js" }],
    } as never);
    expect(validator.validate()).toBe(true);
  });

  it("rejects an empty entries object", () => {
    const validator = new EntriesValidator({} as never);
    expect(validator.validate()).toBe(false);
  });

  it("rejects entries where all arrays are empty", () => {
    const validator = new EntriesValidator({
      [EntriesEnum.RESOURCE]: [],
      [EntriesEnum.NAVIGATION]: [],
    } as never);
    expect(validator.validate()).toBe(false);
  });

  it("returns a descriptive message", () => {
    const validator = new EntriesValidator({} as never);
    expect(validator.message()).toMatch(/entries/i);
  });
});
