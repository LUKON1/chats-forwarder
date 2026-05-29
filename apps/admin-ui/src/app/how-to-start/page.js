"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function HowToStart() {
  const { t } = useLanguage();

  return (
    <div className="flex-grow bg-yale-blue-950 text-lime-cream-50 font-sans p-6 md:p-12 relative">
      {/* Background Grid Pattern */}
      <div className="looping-bg-grid" />

      {/* Main Container */}
      <div className="max-w-4xl w-full mx-auto flex flex-col justify-between min-h-[75vh]">

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
