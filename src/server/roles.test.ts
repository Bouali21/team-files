import { describe, expect, it } from "vitest";
import {
  canComment,
  canEdit,
  cleanName,
  endOfDay,
  inlineType,
  isLive,
  maxRole,
  previewKind,
  typeGroup,
} from "./roles";

describe("roles", () => {
  it("takes the stronger role", () => {
    expect(maxRole("viewer", "editor")).toBe("editor");
    expect(maxRole(null, "commenter")).toBe("commenter");
    expect(maxRole("owner", "editor")).toBe("owner");
  });
  it("gates edit and comment", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("editor")).toBe(true);
    expect(canComment("viewer")).toBe(false);
    expect(canComment("commenter")).toBe(true);
    expect(canComment(null)).toBe(false);
  });
});

describe("files", () => {
  it("groups by type", () => {
    expect(typeGroup("folder", null, "a")).toBe("folder");
    expect(typeGroup("file", "image/png", "a.png")).toBe("image");
    expect(typeGroup("file", "application/octet-stream", "a.pdf")).toBe("pdf");
    expect(typeGroup("file", "text/plain", "a.txt")).toBe("document");
    expect(typeGroup("file", "application/zip", "a.zip")).toBe("other");
  });
  it("never shows script-capable types inline", () => {
    expect(previewKind("image/svg+xml", "a.svg")).toBe("none");
    expect(inlineType("text/html", "a.html")).toBeNull();
    expect(inlineType("text/plain", "a.txt")).toBe("text/plain; charset=utf-8");
    expect(previewKind("video/mp4", "a.mp4")).toBe("video");
  });
  it("rejects empty names", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(" a/b ")).toBe("ab");
  });
  it("expires at the end of the day", () => {
    const end = endOfDay("2026-01-02")!;
    expect(isLive(end, new Date("2026-01-02T12:00:00Z"))).toBe(true);
    expect(isLive(end, new Date("2026-01-03T00:00:00Z"))).toBe(false);
    expect(isLive(null)).toBe(true);
  });
});
