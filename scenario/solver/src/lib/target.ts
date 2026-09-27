import type { SolverContext } from "../stages/tutorials.js";

export type SolverTarget = "local" | "dev" | "prod";

export function normalizeTarget(value: string | undefined): SolverTarget {
  return value === "dev" || value === "prod" ? value : "local";
}

export function defaultStage(target: SolverTarget): string {
  return process.env.CTF_STAGE ?? target;
}

export function hasAwsRuntime(ctx: SolverContext): boolean {
  return !ctx.staticOnly && (ctx.flociAvailable || ctx.awsAvailable);
}

export function isDevTarget(ctx: SolverContext): boolean {
  return ctx.target !== "local";
}

export function usesAwsBedrock(ctx: SolverContext): boolean {
  return isDevTarget(ctx) || process.env.CTF_USE_AWS_BEDROCK === "true";
}

export function bucketName(ctx: SolverContext, baseName: string): string {
  return `${baseName}-${ctx.stage}`;
}

export function secretName(ctx: SolverContext, baseName: string): string {
  return ctx.stage === "prod" ? baseName : `${baseName}-${ctx.stage}`;
}

export function iamUserName(ctx: SolverContext, baseName: string): string {
  return ctx.stage === "prod" ? baseName : `${baseName}-${ctx.stage}`;
}

export function parameterName(ctx: SolverContext, baseName: string): string {
  return ctx.stage === "prod" ? baseName : `${baseName}-${ctx.stage}`;
}

export function roleName(ctx: SolverContext, baseName: string): string {
  return `${baseName}-${ctx.stage}`;
}

export function functionName(ctx: SolverContext, baseName: string): string {
  return `${baseName}-${ctx.stage}`;
}

export function withPortalPath(ctx: SolverContext, path: string): string {
  return portalUrlWithPath(ctx.portalUrl, path);
}

export function portalUrlWithPath(portalUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), ensureTrailingSlash(portalUrl)).toString();
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
