export async function runProjectCommand(
  ctx: { readonly projectRoot: string },
  cmd: string[],
): Promise<string> {
  const proc = Bun.spawn({
    cmd,
    cwd: ctx.projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `${cmd.join(" ")} failed`);
  }
  return stdout;
}
