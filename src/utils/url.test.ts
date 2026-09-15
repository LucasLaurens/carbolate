import { describe, it, expect } from "vitest";
import { isThirdPartyResource, parseDomain, readRegistrableDomain } from "./url";

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

describe("readRegistrableDomain", () => {
  it("keeps the last two labels of a plain host", () => {
    // Act & Assert
    expect(readRegistrableDomain("cdn.assets.example.com")).toBe("example.com");
  });

  it("keeps three labels on a known two-part suffix", () => {
    // Act & Assert — without the exception list, every .co.uk site would be its own third party
    expect(readRegistrableDomain("images.bbc.co.uk")).toBe("bbc.co.uk");
  });

  it("returns a bare host unchanged", () => {
    // Act & Assert
    expect(readRegistrableDomain("localhost")).toBe("localhost");
  });
});

describe("isThirdPartyResource", () => {
  it("counts a subdomain of the page as first-party", () => {
    // Act & Assert — a site's own CDN is not a third party
    expect(isThirdPartyResource("https://cdn.example.com/app.js", "www.example.com")).toBe(false);
  });

  it("counts another registrable domain as third-party", () => {
    // Act & Assert
    expect(isThirdPartyResource("https://www.google-analytics.com/g/collect", "example.com")).toBe(
      true,
    );
  });

  it("counts a two-part suffix sibling as first-party", () => {
    // Act & Assert
    expect(isThirdPartyResource("https://static.bbc.co.uk/x.css", "www.bbc.co.uk")).toBe(false);
  });

  it("counts an inlined resource as first-party", () => {
    // Act & Assert — nothing crossed to anyone: these bytes are the document's own
    expect(isThirdPartyResource("data:image/png;base64,iVBOR", "example.com")).toBe(false);
    expect(isThirdPartyResource("blob:https://example.com/9f2a", "example.com")).toBe(false);
  });

  it("counts an unparseable resource as first-party rather than inventing a third", () => {
    // Act & Assert
    expect(isThirdPartyResource("not-a-url", "example.com")).toBe(false);
  });
});
