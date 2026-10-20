import { afterAll, describe, expect, it } from "vitest";
import { closePool, withTx } from "../helpers/db";

afterAll(closePool);

describe("database connection", () => {
  it("runs a statement inside a rolled-back transaction", async () => {
    await withTx(async (tx) => {
      const result = await tx.query<{ one: number }>("select 1 as one");
      expect(result.rows[0]?.one).toBe(1);
    });
  });
});
