"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap } from "gsap";
import { useLanguage } from "@/context/LanguageContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { push } = useRouter();
  const { t } = useLanguage();
  const formRef = useRef(null);

  // Entrance animation for the login card
  useEffect(() => {
    gsap.from(formRef.current, {
      y: -40,
      opacity: 0,
      duration: 0.8,
      ease: "back.out(1.2)"
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    if (username.length < 3 || username.length > 20) {
      setError(t("username_too_short"));
      return;
    }

    if (password.length < 6) {
      setError(t("password_too_short"));
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("refresh_token", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));
        push("/dashboard");
      } else {
        setError(data.error || t("invalid_credentials"));
      }
    } catch (err) {
      setError(t("server_connection_failed"));
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center bg-yale-blue-950 text-lime-cream-50 p-6 font-sans relative">
      <div className="looping-bg-grid" />

      {/* Auth Box */}
      <div ref={formRef} className="w-full max-w-md bg-yale-blue-900 border-4 border-black p-8 shadow-[8px_8px_0px_#000000] relative">
        {/* Top bar detail */}
        <div className="absolute top-0 inset-x-0 h-2 bg-lime-cream-400 border-b-2 border-black" />

        <div className="text-center mb-8 mt-2">
          <h2 className="text-xl font-bold uppercase tracking-wide text-lime-cream-200">{t("sys_auth")}</h2>
        </div>
        
        {error && (
          <div className="bg-rose-900 border-2 border-black text-lime-cream-50 text-sm font-mono p-3 mb-6 shadow-[2px_2px_0px_#000]">
            {t("error_label")}: {t(error)}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
              {t("username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
              placeholder={t("placeholder_username")}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
              {t("password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-lime-cream-400 text-black font-black uppercase tracking-wider border-2 border-black hover:bg-lime-cream-300 neo-button text-sm"
          >
            {t("login_btn")}
          </button>
        </form>

        <div className="mt-8 text-center text-xs font-mono text-lime-cream-400">
          {t("first_time")}{" "}
          <Link href="/register" className="underline font-bold text-lime-cream-200 hover:text-lime-cream-100">
            {t("register_btn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
