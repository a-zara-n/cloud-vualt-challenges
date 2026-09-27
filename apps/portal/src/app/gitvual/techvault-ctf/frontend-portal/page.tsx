import { headers } from "next/headers";

export default async function RepositoryPage() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "techvault.dev.cloudfortress.security.jaws-ug.jp";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const cloneUrl = `${protocol}://${host}/repos/frontend-portal.git`;

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-card bg-white p-8 shadow-elevated">
        <div className="border-b border-border pb-5">
          <p className="text-sm text-text-secondary">techvault-ctf</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">
            frontend-portal
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            Employee portal frontend for TechVault.
          </p>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Clone
          </h2>
          <code className="mt-3 block overflow-x-auto rounded bg-surface-alt px-4 py-3 text-sm text-text-primary">
            git clone {cloneUrl}
          </code>
        </div>

        <div className="mt-8 overflow-hidden rounded border border-border">
          <div className="border-b border-border bg-surface-alt px-4 py-3 text-sm font-medium text-text-primary">
            Repository files
          </div>
          <ul className="divide-y divide-border text-sm text-text-primary">
            <li className="px-4 py-3">src/</li>
            <li className="px-4 py-3">public/</li>
            <li className="px-4 py-3">package.json</li>
            <li className="px-4 py-3">README.md</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
