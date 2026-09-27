import Link from "next/link";

const repositories = [
  {
    name: "frontend-portal",
    description: "Employee portal frontend for TechVault.",
    href: "/gitvual/techvault-ctf/frontend-portal",
  },
  {
    name: "backend-api",
    description: "Backend API service for TechVault.",
    href: "/gitvual/techvault-ctf/backend-api",
  },
];

export default function OrganizationPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-card bg-white p-8 shadow-elevated">
        <div className="border-b border-border pb-5">
          <p className="text-sm text-text-secondary">GitVual</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">
            techvault-ctf
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            TechVault public repositories.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded border border-border">
          <div className="border-b border-border bg-surface-alt px-4 py-3 text-sm font-medium text-text-primary">
            Repositories
          </div>
          <ul className="divide-y divide-border">
            {repositories.map((repo) => (
              <li key={repo.name} className="px-4 py-4">
                <Link
                  href={repo.href}
                  className="text-base font-semibold text-primary hover:text-primary-hover"
                >
                  {repo.name}
                </Link>
                <p className="mt-1 text-sm text-text-secondary">
                  {repo.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
