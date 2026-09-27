import LoginForm from "@/components/login-form";

const buildNote = "<!-- TODO: remove debug marker before release: TVAULT{hardcoded_secret_in_js} -->";

export default function Home() {
  return (
    <>
      <template dangerouslySetInnerHTML={{ __html: buildNote }} />
      <main className="min-h-screen flex items-center justify-center bg-surface relative">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#1a73e8 1px, transparent 1px), linear-gradient(90deg, #1a73e8 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 w-full max-w-md mx-4">
          {/* Login Card */}
          <div className="bg-white rounded-card shadow-elevated p-8 sm:p-10">
            {/* Logo and branding */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-light rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L3 7V12C3 16.97 7.02 21.63 12 22.63C16.98 21.63 21 16.97 21 12V7L12 2Z"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <path
                    d="M12 2L3 7V12C3 16.97 7.02 21.63 12 22.63C16.98 21.63 21 16.97 21 12V7L12 2ZM12 20.59C7.87 19.69 5 15.76 5 12V8.3L12 4.19L19 8.3V12C19 15.76 16.13 19.69 12 20.59Z"
                    fill="currentColor"
                  />
                  <path
                    d="M10 15.5L7.5 13L8.91 11.59L10 12.67L14.59 8.09L16 9.5L10 15.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-text-primary">
                TechVault
              </h1>
              <p className="text-text-secondary mt-1 text-sm">
                Employee Portal
              </p>
            </div>

            <LoginForm />

            {/* Forgot password link */}
            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:text-primary-hover cursor-default opacity-60"
                disabled
              >
                パスワードをお忘れですか？
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-text-secondary">
            <span>&copy; 2026 TechVault Inc.</span>
            <a
              href="/gitvual/techvault-ctf"
              className="text-primary hover:text-primary-hover"
            >
              GitVual
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
