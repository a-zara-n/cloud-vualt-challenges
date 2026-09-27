/**
 * Terminal Reporter
 *
 * Colored terminal output for CTF challenge solver results.
 * Groups results by category and prints a summary at the end.
 */

// ANSI color codes
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const MAGENTA = "\x1b[35m";

export interface StageResult {
  readonly id: string;
  readonly name: string;
  readonly status: "pass" | "fail" | "skip";
  readonly flag?: string;
  readonly error?: string;
  readonly category: Category;
}

export type Category = "Tutorial" | "Main" | "Bonus" | "Advanced";

interface Summary {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly total: number;
}

interface EnvironmentInfo {
  readonly target: string;
  readonly stage: string;
  readonly localstack: boolean;
  readonly aws: boolean;
  readonly portal: boolean;
  readonly portalUrl: string;
}

export class Reporter {
  private readonly results: StageResult[] = [];

  addResult(result: StageResult): void {
    this.results.push(result);
    this.printResult(result);
  }

  printBanner(): void {
    console.log("");
    console.log(
      `${CYAN}${BOLD}  ================================================${RESET}`
    );
    console.log(
      `${CYAN}${BOLD}   Cloud Vault Challenge Solver v1.0${RESET}`
    );
    console.log(
      `${CYAN}${BOLD}   Validating all 27 challenges${RESET}`
    );
    console.log(
      `${CYAN}${BOLD}  ================================================${RESET}`
    );
    console.log("");
  }

  printCategoryHeader(category: Category): void {
    console.log("");
    console.log(
      `${MAGENTA}${BOLD}  --- ${category} ---${RESET}`
    );
    console.log("");
  }

  printEnvironment(env: EnvironmentInfo): void {
    const ls = env.localstack
      ? `${GREEN}Running${RESET}`
      : `${YELLOW}Not available${RESET}`;
    const aws = env.aws
      ? `${GREEN}Enabled${RESET}`
      : `${YELLOW}Not enabled${RESET}`;
    const pt = env.portal
      ? `${GREEN}Running${RESET}`
      : `${YELLOW}Not available${RESET}`;
    console.log(`  Target:      ${env.target}`);
    console.log(`  Stage:       ${env.stage}`);
    console.log(`  AWS:         ${aws}`);
    console.log(`  LocalStack:  ${ls}`);
    console.log(`  Portal:      ${pt}`);
    console.log(`  Portal URL:  ${env.portalUrl}`);
    console.log("");
  }

  printSummary(): void {
    const categories: Category[] = ["Tutorial", "Main", "Bonus", "Advanced"];

    console.log("");
    console.log(
      `${CYAN}${BOLD}  ================================================${RESET}`
    );
    console.log(
      `${CYAN}${BOLD}   Summary${RESET}`
    );
    console.log(
      `${CYAN}${BOLD}  ================================================${RESET}`
    );

    for (const category of categories) {
      const categoryResults = this.results.filter(
        (r) => r.category === category
      );
      if (categoryResults.length === 0) continue;

      const summary = this.computeSummary(categoryResults);
      console.log("");
      console.log(`  ${BOLD}${category}${RESET}`);
      this.printSummaryLine(summary);
    }

    const total = this.computeSummary(this.results);
    console.log("");
    console.log(
      `${BOLD}  ────────────────────────────────────────────────${RESET}`
    );
    console.log(`  ${BOLD}Total${RESET}`);
    this.printSummaryLine(total);

    console.log("");

    if (total.failed === 0 && total.skipped === 0) {
      console.log(
        `  ${GREEN}${BOLD}All challenges validated successfully!${RESET}`
      );
    } else if (total.failed === 0) {
      console.log(
        `  ${GREEN}${BOLD}All attempted challenges passed!${RESET} ${DIM}(${total.skipped} skipped)${RESET}`
      );
    } else {
      console.log(
        `  ${RED}${BOLD}${total.failed} challenge(s) failed.${RESET}`
      );
    }
    console.log("");
  }

  getResults(): readonly StageResult[] {
    return this.results;
  }

  hasFailures(): boolean {
    return this.results.some((r) => r.status === "fail");
  }

  private printResult(result: StageResult): void {
    const icon =
      result.status === "pass"
        ? `${GREEN}\u2705`
        : result.status === "fail"
          ? `${RED}\u274C`
          : `${YELLOW}\u23ED\uFE0F`;
    const label =
      result.status === "pass"
        ? "PASS"
        : result.status === "fail"
          ? "FAIL"
          : "SKIP";

    const flagStr = result.flag
      ? ` ${DIM}${result.flag}${RESET}`
      : "";
    const errorStr = result.error
      ? ` ${DIM}(${result.error})${RESET}`
      : "";

    console.log(
      `  ${icon} ${label}${RESET}  ${BOLD}${result.id}${RESET} - ${result.name}${flagStr}${errorStr}`
    );
  }

  private printSummaryLine(summary: Summary): void {
    const parts: string[] = [];
    if (summary.passed > 0) {
      parts.push(`${GREEN}${summary.passed} passed${RESET}`);
    }
    if (summary.failed > 0) {
      parts.push(`${RED}${summary.failed} failed${RESET}`);
    }
    if (summary.skipped > 0) {
      parts.push(`${YELLOW}${summary.skipped} skipped${RESET}`);
    }
    console.log(`    ${parts.join(", ")} ${DIM}(${summary.total} total)${RESET}`);
  }

  private computeSummary(results: readonly StageResult[]): Summary {
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const skipped = results.filter((r) => r.status === "skip").length;
    return { passed, failed, skipped, total: results.length };
  }
}
