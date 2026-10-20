// Deletes the `next dev` cache so browser tests compile styles and code from scratch.
// Only .next/dev is removed: the production build in .next must survive for `pnpm check:bundle`.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const devCache = fileURLToPath(new URL("../.next/dev", import.meta.url));
rmSync(devCache, { recursive: true, force: true, maxRetries: 3 });
console.log("Cleared .next/dev");
