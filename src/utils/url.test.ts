import { describe, it, expect } from "vitest";
import { parseDomain } from "./url";

describe("parseDomain", () => {
  it("returns valid domain for http URL", () => {
    expect(parseDomain("http://example.com/path")).toEqual({
      valid: true,
      domain: "example.com",
    });
  });

  it("returns valid domain for https URL", () => {
    expect(parseDomain("https://sub.example.com")).toEqual({
      valid: true,
      domain: "sub.example.com",
    });
  });

  it("rejects malformed URL", () => {
    expect(parseDomain("not-a-url")).toEqual({ valid: false });
  });

  it("rejects chrome:// protocol", () => {
    expect(parseDomain("chrome://newtab")).toEqual({ valid: false });
  });

  it("rejects file:// protocol", () => {
    expect(parseDomain("file:///home/user/index.html")).toEqual({ valid: false });
  });

  it("rejects about:blank", () => {
    expect(parseDomain("about:blank")).toEqual({ valid: false });
  });
});
