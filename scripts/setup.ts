import { runCommand } from "./_helpers";

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const skipBootstrap = args.has("--skip-bootstrap");
  const skipDeploy = args.has("--skip-deploy");

  console.log("[setup] Cloud Vault 問題サーバーのローカルセットアップを開始します");

  await runCommand("static challenge assets", [
    "bun",
    "run",
    "scripts/setup-additional.ts",
    "--static-only",
  ]);

  await runCommand("floci", ["./scripts/floci.sh", "up"]);

  if (!skipBootstrap) {
    await runCommand("infra bootstrap", [
      "zsh",
      "-lc",
      "bun run --cwd apps/infra scripts/cdkfloci.ts bootstrap --context stage=local --context challengeOnly=true",
    ]);
  }

  if (!skipDeploy) {
    await runCommand("infra deploy", ["bun", "run", "scripts/deploy-floci.ts"]);

    await runCommand("s3 assets", ["./scripts/upload-local-s3-assets.sh"]);
    await runCommand("additional local assets", [
      "bun",
      "run",
      "scripts/setup-additional.ts",
    ]);
  }

  console.log("\n[setup] 完了しました");
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? `[setup] ${error.message}` : "[setup] failed",
  );
  process.exit(1);
}
