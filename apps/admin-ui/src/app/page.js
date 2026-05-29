"use client";

import MessageFlowAnimation from "@/components/MessageFlowAnimation";
import TelegramIcon from "@/assets/icons/TelegramIcon";
import VkIcon from "@/assets/icons/VkIcon";
import DashboardPreview from "@/components/DashboardPreview";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="flex-grow bg-yale-blue-950 text-lime-cream-50 font-sans p-6 md:p-12 relative flex flex-col justify-center">
      {/* Background Grid Pattern */}
      <div className="looping-bg-grid" />

      {/* Main Container */}
      <div className="max-w-4xl w-full mx-auto flex flex-col justify-between min-h-[75vh]">
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
