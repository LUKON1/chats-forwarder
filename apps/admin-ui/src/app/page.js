"use client";

import Link from "next/link";
import MessageFlowAnimation from "@/components/MessageFlowAnimation";
import TelegramIcon from "@/assets/icons/TelegramIcon";
import VkIcon from "@/assets/icons/VkIcon";
import DashboardPreview from "@/components/DashboardPreview";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { locale, t, changeLocale } = useLanguage();

  return (
    <div className="flex-1 min-h-screen bg-yale-blue-950 text-lime-cream-50 font-sans p-6 md:p-12 relative">
      {/* Background Grid Pattern */}
      <div className="looping-bg-grid" />

      {/* Main Container */}
      <div className="max-w-4xl mx-auto flex flex-col justify-between min-h-[85vh]">
        {/* Header Navigation */}
        <header className="flex justify-between items-center py-6 border-b-4 border-black gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-lime-cream-400 border-2 border-black flex items-center justify-center font-mono font-bold text-black text-xl shadow-[2px_2px_0px_#000]">
              {t("logo")}
            </div>
            <span className="font-mono font-bold tracking-tight text-xl">{t("title")}</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Language Switcher Dropdown */}
            <div className="relative">
              <select
                value={locale}
                onChange={(e) => changeLocale(e.target.value)}
                className="bg-yale-blue-900 border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-lime-cream-200 focus:outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[10px] font-bold text-lime-cream-400">
                ▼
              </div>
            </div>

            <Link 
              href="/how-to-start" 
              className="px-4 py-2 bg-yale-blue-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
            >
              {t("how_to_start")}
            </Link>
            <Link 
              href="/login" 
              className="px-4 py-2 bg-yale-blue-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
            >
              {t("signin")}
            </Link>
            <Link 
              href="/register" 
              className="px-4 py-2 bg-lime-cream-400 text-black border-2 border-black text-sm font-bold uppercase tracking-wider neo-button"
            >
              {t("signup")}
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <main className="my-12 md:my-20 flex flex-col space-y-10">
          <div className="space-y-6">
            <div className="inline-block bg-tropical-teal-500 text-black text-xs font-bold uppercase tracking-widest px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000]">
              {t("smm_automation")}
            </div>
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-none text-lime-cream-200">
              {t("hero_headline")}
            </h1>
            <p className="text-lg md:text-xl text-lime-cream-300 max-w-2xl font-medium leading-relaxed">
              {t("hero_sub")}
            </p>
          </div>

          {/* Interactive Dashboard Preview */}
          <DashboardPreview />

          {/* Call to Actions & Details */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-300">{t("reliable_title")}</h3>
              <p className="text-sm text-lime-cream-400">
                {t("reliable_desc")}
              </p>
            </div>
            <div className="flex-1 neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-300">{t("flow_title")}</h3>
              <p className="text-sm text-lime-cream-400">
                {t("flow_desc")}
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t-4 border-black py-8 flex flex-col md:flex-row justify-between items-center text-sm font-mono text-lime-cream-400">
          <div>&copy; {t("footer_text")}</div>
        </footer>
      </div>
    </div>
  );
}
