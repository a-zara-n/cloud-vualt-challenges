"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  disabled?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "AI Assistant" },
  { href: "#", label: "Documents", disabled: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Nav links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 no-underline">
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-button">
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L3 7V12C3 16.97 7.02 21.63 12 22.63C16.98 21.63 21 16.97 21 12V7L12 2Z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-text-primary">
                TechVault
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                if (link.disabled) {
                  return (
                    <span
                      key={link.label}
                      className="px-3 py-2 text-sm text-text-secondary opacity-50 cursor-not-allowed"
                    >
                      {link.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 text-sm rounded-button no-underline transition-colors relative ${
                      isActive
                        ? "text-primary font-medium"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: User info + logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-sm text-text-secondary">Employee</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <button
              onClick={handleLogout}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-2 py-1"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              if (link.disabled) {
                return (
                  <span
                    key={link.label}
                    className="block px-3 py-2 text-sm text-text-secondary opacity-50"
                  >
                    {link.label}
                  </span>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2 text-sm rounded-button no-underline ${
                    isActive
                      ? "text-primary bg-primary-light font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-sm text-text-secondary">Employee</span>
              </div>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
