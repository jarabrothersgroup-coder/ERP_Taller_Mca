import { describe, it, expect, afterAll } from "vitest";
import { getDb, validateConnection, closeDb } from "../../src/shared/database/connection.js";

describe("Database connection", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("getDb returns a postgres Sql instance", () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db).toBe("function");
  });

  it("getDb is a singleton (same instance)", () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it("closeDb does not throw when called twice", async () => {
    await closeDb();
    await expect(closeDb()).resolves.toBeUndefined();
  });

  it("can reinitialize after closeDb", async () => {
    await closeDb();
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db).toBe("function");
  });

  it("validateConnection returns a boolean (not throws)", async () => {
    const result = await validateConnection();
    expect(typeof result).toBe("boolean");
  });
});
