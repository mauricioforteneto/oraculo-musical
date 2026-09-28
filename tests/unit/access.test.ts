import { describe, expect, it } from "vitest";
import { ownerAccess, sameOrigin } from "../../src/lib/access";
describe("acesso pessoal", () => {
  it("nega configuração ausente mesmo para usuário autenticado", () => {
    expect(ownerAccess(undefined, "visitor")).toBe("unconfigured");
    expect(ownerAccess(" ", "visitor")).toBe("unconfigured");
  });
  it("exige identidade autenticada e exatamente o dono", () => {
    expect(ownerAccess("owner", undefined)).toBe("unauthenticated");
    expect(ownerAccess("owner", "visitor")).toBe("forbidden");
    expect(ownerAccess("owner", "owner")).toBe("allowed");
  });
  it("rejeita origem ausente, malformada e host parecido", () => {
    expect(sameOrigin(null, "https://music.example")).toBe(false);
    expect(sameOrigin("https://music.example.evil.test", "https://music.example")).toBe(false);
    expect(sameOrigin("http://music.example", "https://music.example")).toBe(false);
    expect(sameOrigin("https://music.example", undefined)).toBe(false);
    expect(sameOrigin("https://music.example", "https://music.example")).toBe(true);
  });
});
