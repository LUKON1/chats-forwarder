"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import DashboardPreview from "@/components/DashboardPreview";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  const containerRef = useRef(null);

  // Entrance animations for the landing page elements
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      // Animate badge, main headline, and sub headline
      tl.from(".hero-text > *", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out"
      });

      // Animate interactive dashboard component wrapper
      tl.from(".dashboard-preview-wrapper", {
        scale: 0.96,
        opacity: 0,
        duration: 0.9,
        ease: "power2.out"
      }, "-=0.5");

      // Animate lower CTA/info blocks
      tl.from(".cta-box", {
        y: 30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: "power2.out"
      }, "-=0.4");
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="flex-grow bg-yale-blue-950 text-lime-cream-50 font-sans p-6 md:p-12 relative flex flex-col justify-center">
      {/* Background Grid Pattern */}
      <div className="looping-bg-grid" />

      {/* Main Container */}
      <div className="max-w-4xl w-full mx-auto flex flex-col justify-between min-h-[75vh]">
        {/* Hero Section */}
        <main className="my-12 md:my-20 flex flex-col space-y-10">
          <div className="space-y-6 hero-text">
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
          <div className="dashboard-preview-wrapper">
            <DashboardPreview />
          </div>

          {/* Call to Actions & Details */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 neo-box p-6 bg-yale-blue-900 cta-box">
              <h3 className="text-xl font-bold uppercase mb-2 text-lime-cream-300">{t("reliable_title")}</h3>
              <p className="text-sm text-lime-cream-400">
                {t("reliable_desc")}
              </p>
            </div>
            <div className="flex-1 neo-box p-6 bg-yale-blue-900 cta-box">
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
