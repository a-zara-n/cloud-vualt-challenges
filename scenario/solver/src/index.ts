/**
 * Cloud Vault challenge solver - Main Orchestrator
 *
 * Validates all 27 CTF challenges by running stage solvers
 * against LocalStack services and static file analysis.
 *
 * Usage:
 *   bun run src/index.ts              # Run all stages
 *   bun run src/index.ts --stage t1   # Run specific stage
 *   bun run src/index.ts --static     # Static file checks only (no network)
 */

import { resolve, dirname } from "path";
import { Reporter } from "./lib/reporter.js";
import type { Category, StageResult } from "./lib/reporter.js";
import { solveTutorials } from "./stages/tutorials.js";
import type { SolverContext } from "./stages/tutorials.js";
import { solveMain } from "./stages/main.js";
import { solveBonus } from "./stages/bonus.js";
import { solveAdvanced } from "./stages/advanced.js";
import { LOCALSTACK_ENDPOINT } from "./lib/aws.js";
import { defaultStage, normalizeTarget, portalUrlWithPath } from "./lib/target.js";
import type { SolverTarget } from "./lib/target.js";

// Resolve project root from this file's location
// scenario/solver/src/index.ts -> project root is 3 levels up
const PROJECT_ROOT = resolve(dirname(import.meta.dir), "..", "..");

interface CliArgs {
  readonly stage: string | null;
  readonly staticOnly: boolean;
  readonly target: SolverTarget;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let stage: string | null = null;
  let staticOnly = false;
  let target = normalizeTarget(process.env.CTF_SOLVER_TARGET);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--stage" && i + 1 < args.length) {
      stage = args[i + 1].toLowerCase();
      i++;
    } else if (arg === "--static") {
      staticOnly = true;
    } else if (arg === "--target" && i + 1 < args.length) {
      target = normalizeTarget(args[i + 1]);
      i++;
    }
  }

  return { stage, staticOnly, target };
}

async function checkLocalStack(endpoint: string): Promise<boolean> {
  try {
    const resp = await fetch(new URL("/_localstack/health", endpoint), {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function checkPortal(portalUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(portalUrlWithPath(portalUrl, "/api/ping"), {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function filterByStage(
  results: readonly StageResult[],
  stageId: string
): readonly StageResult[] {
  const normalized = stageId.toLowerCase().replace(/[\s-_]/g, "");
  return results.filter((r) => {
    const resultId = r.id.toLowerCase().replace(/[\s-_]/g, "");
    return resultId === normalized;
  });
}

type StageSolverFn = (ctx: SolverContext) => Promise<readonly StageResult[]>;

interface StageGroup {
  readonly category: Category;
  readonly solver: StageSolverFn;
}

const STAGE_GROUPS: readonly StageGroup[] = [
  { category: "Tutorial", solver: solveTutorials },
  { category: "Main", solver: solveMain },
  { category: "Bonus", solver: solveBonus },
  { category: "Advanced", solver: solveAdvanced },
];

function defaultPortalUrl(target: SolverTarget): string {
  if (target === "prod") {
    return "https://techvault.cloudfortress.security.jaws-ug.jp";
  }
  if (target === "dev") {
    return "https://techvault.dev.cloudfortress.security.jaws-ug.jp";
  }
  return "http://localhost:3000";
}

async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const reporter = new Reporter();

  reporter.printBanner();

  const stage = defaultStage(cliArgs.target);
  const portalUrl = process.env.CTF_PORTAL_URL ?? process.env.TVAULT_PORTAL_URL ?? defaultPortalUrl(cliArgs.target);

  // Environment checks
  const localstackAvailable = cliArgs.staticOnly
    ? false
    : cliArgs.target === "local"
      ? await checkLocalStack(LOCALSTACK_ENDPOINT)
      : false;
  const portalAvailable = cliArgs.staticOnly ? false : await checkPortal(portalUrl);
  const awsAvailable = !cliArgs.staticOnly && cliArgs.target !== "local";

  reporter.printEnvironment({
    target: cliArgs.target,
    stage,
    localstack: localstackAvailable,
    portal: portalAvailable,
    portalUrl,
    aws: awsAvailable,
  });

  const ctx: SolverContext = {
    projectRoot: PROJECT_ROOT,
    target: cliArgs.target,
    stage,
    localstackAvailable,
    awsAvailable,
    portalAvailable,
    portalUrl,
    localstackEndpoint: LOCALSTACK_ENDPOINT,
    staticOnly: cliArgs.staticOnly,
  };

  if (cliArgs.stage) {
    // Run a specific stage
    console.log(`  Running stage: ${cliArgs.stage}\n`);

    let found = false;
    for (const group of STAGE_GROUPS) {
      const results = await group.solver(ctx);
      const filtered = filterByStage(results, cliArgs.stage);
      if (filtered.length > 0) {
        found = true;
        reporter.printCategoryHeader(group.category);
        for (const result of filtered) {
          reporter.addResult(result);
        }
        break;
      }
    }

    if (!found) {
      console.log(`  Stage "${cliArgs.stage}" not found.\n`);
      console.log("  Available stages:");
      console.log("    Tutorial:  t1, t2, t3, t4, t5, t6");
      console.log(
        "    Main:      stage0, stage1a, stage1b, stage1c, stage1d, stage2a, stage2b, stage2d, stage2e, stage2g, stage3a, final"
      );
      console.log("    Bonus:     stage2c, stage2f, stage3b, stage3d, stage5b");
      console.log("    Advanced:  stage3c, stage3e, stage4, stage5");
      console.log("");
      process.exit(1);
    }
  } else {
    // Run all stages
    for (const group of STAGE_GROUPS) {
      reporter.printCategoryHeader(group.category);
      const results = await group.solver(ctx);
      for (const result of results) {
        reporter.addResult(result);
      }
    }
  }

  reporter.printSummary();

  // Exit with non-zero if any failures
  if (reporter.hasFailures()) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
