"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function HowToStart() {
  const { locale, t, changeLocale } = useLanguage();

  return (
    <div className="flex-1 min-h-screen bg-yale-blue-950 text-lime-cream-50 font-sans p-6 md:p-12 relative">
      {/* Background Grid Pattern */}
      <div className="looping-bg-grid" />

      {/* Main Container */}
      <div className="max-w-4xl mx-auto flex flex-col justify-between min-h-[85vh]">
        {/* Header Navigation */}
        <header className="flex justify-between items-center py-6 border-b-4 border-black gap-4 flex-wrap z-10">
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
              href="/" 
              className="px-4 py-2 bg-yale-blue-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-200"
            >
              {t("docs_back_to_landing")}
            </Link>
          </div>
        </header>

        {/* Documentation Content */}
        <main className="my-12 md:my-16 z-10 flex flex-col space-y-10">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase text-lime-cream-200">
              {t("docs_intro_title")}
            </h1>
            <p className="text-lg text-lime-cream-300 max-w-2xl font-medium leading-relaxed">
              {t("docs_intro_sub")}
            </p>
          </div>

          {/* Steps List */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-200">
                {t("docs_step1_title")}
              </h3>
              <p className="text-sm text-lime-cream-400 leading-relaxed">
                {t("docs_step1_desc")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-200">
                {t("docs_step2_title")}
              </h3>
              <p className="text-sm text-lime-cream-400 leading-relaxed">
                {t("docs_step2_desc")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-200">
                {t("docs_step3_title")}
              </h3>
              <p className="text-sm text-lime-cream-400 leading-relaxed">
                {t("docs_step3_desc")}
              </p>
            </div>

            {/* Step 4 */}
            <div className="neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-200">
                {t("docs_step4_title")}
              </h3>
              <p className="text-sm text-lime-cream-400 leading-relaxed">
                {t("docs_step4_desc")}
              </p>
            </div>

            {/* Step 5 */}
            <div className="neo-box p-6 bg-yale-blue-900">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-200">
                {t("docs_step5_title")}
              </h3>
              <p className="text-sm text-lime-cream-400 leading-relaxed">
                {t("docs_step5_desc")}
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t-4 border-black py-8 flex justify-between items-center text-sm font-mono text-lime-cream-400 z-10">
          <div>&copy; {t("footer_text")}</div>
        </footer>
      </div>
    </div>
  );
}
