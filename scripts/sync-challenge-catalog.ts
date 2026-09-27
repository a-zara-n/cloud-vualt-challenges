import { resolve } from "node:path";

const source = resolve(import.meta.dir, "../season/Cloud-Vault/challenges.json");
const destination = resolve(
  import.meta.dir,
  "../apps/infra/lambda/challenge-server/challenges.json",
);

await Bun.write(destination, Bun.file(source));
console.log(`[challenge catalog] ${source} -> ${destination}`);
