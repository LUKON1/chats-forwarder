"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import Logo from "@/components/Logo";

/**
 * Global Header navigation component with mobile adaptation
 */
export default function Header() {
  const pathname = usePathname();
  const { push } = useRouter();
  const { locale, t, changeLocale } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /* Check authentication status on mount and path changes */
  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in") === "true";
    setIsLoggedIn(loggedIn);
    setIsMenuOpen(false);
  }, [pathname]);

  /* Handle system log out */
  const handleLogout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
      } catch (err) {
        console.error("Failed to notify server about logout:", err);
      }
    }
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    push("/login");
  }, [push]);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 py-4 md:py-5 border-b-4 border-black bg-yale-blue-900 select-none">
      {/* Brand Identity / Clickable Logo */}
      <Link href="/" className="flex items-center space-x-3 group">
        <Logo className="w-12 h-12 md:w-15 md:h-15" spin={true} />
        <span className="font-mono font-bold tracking-tight text-lg md:text-xl text-lime-cream-100 group-hover:text-lime-cream-300 transition-colors">
          {t("title")}
        </span>
      </Link>

      {/* Desktop Navigation Controls */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Language Switcher */}
        <div className="relative">
          <select
            value={locale}
            onChange={(e) => changeLocale(e.target.value)}
            className="bg-yale-blue-950 border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-lime-cream-200 focus:outline-none cursor-pointer appearance-none pr-8"
          >
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[10px] font-bold text-lime-cream-400">
            ▼
          </div>
        </div>

        {/* Auth-dependent Navigation */}
        {isLoggedIn ? (
          <>
            {pathname !== "/dashboard" && (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
              >
                {t("dashboard_preview")}
              </Link>
            )}
            {pathname !== "/how-to-start" && (
              <Link
                href="/how-to-start"
                className="px-4 py-2 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
              >
                {t("how_to_start")}
              </Link>
            )}
            <button
              onClick={handleLogout}
              type="button"
              className="px-4 py-2 bg-rose-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-100"
            >
              {t("logout")}
            </button>
          </>
        ) : (
          <>
            {pathname !== "/how-to-start" && (
              <Link
                href="/how-to-start"
                className="px-4 py-2 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
              >
                {t("how_to_start")}
              </Link>
            )}
            {pathname !== "/login" && (
              <Link
                href="/login"
                className="px-4 py-2 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
              >
                {t("signin")}
              </Link>
            )}
            {pathname !== "/register" && (
              <Link
                href="/register"
                className="px-4 py-2 bg-lime-cream-400 text-black border-2 border-black text-sm font-bold uppercase tracking-wider neo-button"
              >
                {t("signup")}
              </Link>
            )}
          </>
        )}
      </div>

      {/* Mobile Burger Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="md:hidden p-2 bg-yale-blue-950 border-2 border-black neo-button text-lime-cream-200 focus:outline-none"
        aria-label="Toggle navigation menu"
      >
        <div className="w-6 h-5 flex flex-col justify-between items-center relative py-0.5">
          <span className={`w-5 h-0.75 bg-current transition-all duration-300 rounded-sm ${isMenuOpen ? "rotate-45 translate-y-1.75" : ""}`} />
          <span className={`w-5 h-0.75 bg-current transition-all duration-300 rounded-sm ${isMenuOpen ? "opacity-0" : ""}`} />
          <span className={`w-5 h-0.75 bg-current transition-all duration-300 rounded-sm ${isMenuOpen ? "-rotate-45 -translate-y-1.75" : ""}`} />
        </div>
      </button>

      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-yale-blue-900 border-b-4 border-black p-6 flex flex-col space-y-4 shadow-[0_8px_0px_rgba(0,0,0,0.5)] z-40 md:hidden">
          {/* Language Switcher in Mobile Menu */}
          <div className="flex items-center justify-between border-b border-black pb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-lime-cream-300">
              {locale === "ru" ? "Язык / Language" : "Language / Язык"}
            </span>
            <div className="relative">
              <select
                value={locale}
                onChange={(e) => changeLocale(e.target.value)}
                className="bg-yale-blue-950 border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-lime-cream-200 focus:outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[10px] font-bold text-lime-cream-400">
                ▼
              </div>
            </div>
          </div>

          {/* Links List */}
          <div className="flex flex-col space-y-3 pt-2">
            {isLoggedIn ? (
              <>
                {pathname !== "/dashboard" && (
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-4 py-3 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
                  >
                    {t("dashboard_preview")}
                  </Link>
                )}
                {pathname !== "/how-to-start" && (
                  <Link
                    href="/how-to-start"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-4 py-3 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
                  >
                    {t("how_to_start")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  type="button"
                  className="w-full text-center px-4 py-3 bg-rose-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-100"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                {pathname !== "/how-to-start" && (
                  <Link
                    href="/how-to-start"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-4 py-3 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
                  >
                    {t("how_to_start")}
                  </Link>
                )}
                {pathname !== "/login" && (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-4 py-3 bg-yale-blue-950 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
                  >
                    {t("signin")}
                  </Link>
                )}
                {pathname !== "/register" && (
                  <Link
                    href="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-4 py-3 bg-lime-cream-400 text-black border-2 border-black text-sm font-bold uppercase tracking-wider neo-button"
                  >
                    {t("signup")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
