"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";


export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { push } = useRouter();
  const { t } = useLanguage();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // Validate input fields
    if (username.length < 3 || username.length > 20) {
      setError(t("username_too_short"));
      return;
    }

    if (password.length < 6) {
      setError(t("password_too_short"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("pw_mismatch"));
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          push("/login");
        }, 1500);
      } else {
        setError(data.error || t("registration_failed"));
      }
    } catch (err) {
      setError(t("server_connection_failed"));
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center bg-yale-blue-950 text-lime-cream-50 p-6 font-sans relative">
      <div className="looping-bg-grid" />

      {/* Auth Box */}
      <div className="w-full max-w-md bg-yale-blue-900 border-4 border-black p-8 shadow-[8px_8px_0px_#000000] relative">
        {/* Top bar detail */}
        <div className="absolute top-0 inset-x-0 h-2 bg-tropical-teal-500 border-b-2 border-black" />

        <div className="text-center mb-8 mt-2">
          <h2 className="text-xl font-bold uppercase tracking-wide text-lime-cream-200">{t("register_title")}</h2>
        </div>
        
        {error && (
          <div className="bg-rose-900 border-2 border-black text-lime-cream-50 text-sm font-mono p-3 mb-6 shadow-[2px_2px_0px_#000]">
            {t("error_label")}: {t(error)}
          </div>
        )}

        {success && (
          <div className="bg-emerald-800 border-2 border-black text-lime-cream-50 text-sm font-mono p-3 mb-6 shadow-[2px_2px_0px_#000]">
            {t("success_label")}: {t("redirecting")}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-1">
              {t("username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
              placeholder={t("placeholder_username")}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-1">
              {t("password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-1">
              {t("confirm_password")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-tropical-teal-500 text-black font-black uppercase tracking-wider border-2 border-black hover:bg-tropical-teal-400 neo-button text-sm mt-2"
          >
            {t("register_btn")}
          </button>
        </form>

        <div className="mt-8 text-center text-xs font-mono text-lime-cream-400">
          {t("already_registered")}{" "}
          <Link href="/login" className="underline font-bold text-lime-cream-200 hover:text-lime-cream-100">
            {t("signin_here")}
          </Link>
        </div>
      </div>
    </div>
  );
}
