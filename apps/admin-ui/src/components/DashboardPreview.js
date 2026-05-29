"use client";

import { useState } from "react";
import Link from "next/link";
import TelegramIcon from "@/assets/icons/TelegramIcon";
import VkIcon from "@/assets/icons/VkIcon";
import MessageFlowAnimation from "@/components/MessageFlowAnimation";
import { useLanguage } from "@/context/LanguageContext";

export default function DashboardPreview() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("routes");

  /* Client-side mock chats state for landing preview */
  const [chats] = useState([
    { id: 1, name: "CF Tech News VK", platform: "vk", externalId: "club19384910" },
    { id: 2, name: "Memes Hub Community", platform: "vk", externalId: "club2048590" },
    { id: 3, name: "CF Broadcast Telegram", platform: "tg", externalId: "@cf_broadcaster" },
    { id: 4, name: "Dev Ops Tech Chat", platform: "tg", externalId: "-100492810" }
  ]);

  /* Client-side mock routes state for preview interaction */
  const [routes, setRoutes] = useState([
    { 
      id: 1, 
      title: "Tech News Auto-Post", 
      sourceId: 1, 
      sourcePlatform: "vk",
      targetId: 3, 
      targetPlatform: "tg",
      isReversed: false,
      showAuthor: true
    },
    { 
      id: 2, 
      title: "Community Sync Pipeline", 
      sourceId: 4, 
      sourcePlatform: "tg",
      targetId: 2, 
      targetPlatform: "vk",
      isReversed: false,
      showAuthor: true
    }
  ]);

  /* Swap direction on landing preview by toggling isReversed */
  const handleReverseDirection = (id) => {
    setRoutes(
      routes.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            isReversed: !r.isReversed
          };
        }
        return r;
      })
    );
  };

  /* Toggle sender name prefix visibility on landing preview */
  const handleToggleShowAuthor = (id) => {
    setRoutes(
      routes.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            showAuthor: !r.showAuthor
          };
        }
        return r;
      })
    );
  };

  return (
    <div className="w-full bg-yale-blue-900 border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_#000000] relative">
      {/* Top Banner Label */}
      <div className="absolute -top-3.5 right-6 bg-lime-cream-400 text-black border-2 border-black px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_#000]">
        {t("dashboard_preview")}
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold uppercase text-lime-cream-200">
          {t("dashboard_preview")}
        </h3>
        <p className="text-xs text-lime-cream-400 font-mono mt-1">
          {t("dashboard_preview_desc")}
        </p>
      </div>

      {/* Nav Tabs Mock */}
      <div className="flex border-b-2 border-black mb-8 space-x-2 text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab("routes")}
          type="button"
          className={`px-4 py-2 border-t-2 border-x-2 border-black transition-transform duration-75 ${
            activeTab === "routes"
              ? "bg-lime-cream-400 text-black border-b-2 border-b-lime-cream-400 translate-y-0.5"
              : "bg-yale-blue-950 text-lime-cream-300 hover:text-lime-cream-50"
          }`}
        >
          {t("routes_tab")}
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          type="button"
          className={`px-4 py-2 border-t-2 border-x-2 border-black transition-transform duration-75 ${
            activeTab === "chats"
              ? "bg-lime-cream-400 text-black border-b-2 border-b-lime-cream-400 translate-y-0.5"
              : "bg-yale-blue-950 text-lime-cream-300 hover:text-lime-cream-50"
          }`}
        >
          {t("chats_tab")}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="min-h-[250px]">
        {activeTab === "routes" && (
          <div className="space-y-6">
            {routes.map((route) => {
              const sourceChat = chats.find((c) => c.platform === route.sourcePlatform && c.id === route.sourceId);
              const targetChat = chats.find((c) => c.platform === route.targetPlatform && c.id === route.targetId);
              const flowDirection = route.isReversed ? "right-to-left" : "left-to-right";

              return (
                <div key={route.id} className="p-5 bg-yale-blue-950 border-2 border-black relative overflow-hidden flex flex-col space-y-4">
                  {/* Pipeline Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h4 className="font-black text-sm uppercase text-lime-cream-200">
                        {route.title}
                      </h4>
                    </div>

                    <div className="flex space-x-2 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleToggleShowAuthor(route.id)}
                        type="button"
                        className={`px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase tracking-wider neo-button ${
                          route.showAuthor
                            ? "bg-tropical-teal-500 text-black"
                            : "bg-yale-blue-900 text-zinc-400"
                        }`}
                      >
                        {route.showAuthor ? t("author_shown") : t("author_hidden")}
                      </button>
                      <div className="px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase tracking-wider bg-lime-cream-400 text-black select-none">
                        {t("active")}
                      </div>
                    </div>
                  </div>

                  {/* Flow Visualization with U-shape Conveyor */}
                  <div className="relative pb-28">
                    <div className="flex justify-between items-center bg-yale-blue-900 p-3 border-2 border-black text-xs relative z-20">
                      {/* Source */}
                      <div className="flex items-center space-x-2">
                        {route.sourcePlatform === "vk" ? <VkIcon className="w-6 h-6" /> : <TelegramIcon className="w-6 h-6" />}
                        <div>
                          <div className="text-[9px] uppercase font-bold text-lime-cream-400">{t("source")}</div>
                          <div className="font-black uppercase text-lime-cream-200">{sourceChat?.name}</div>
                        </div>
                      </div>

                      {/* Direction Reverse Toggle */}
                      <button
                        onClick={() => handleReverseDirection(route.id)}
                        type="button"
                        title="Reverse flow"
                        className="w-8 h-8 bg-tropical-teal-500 text-black border-2 border-black flex items-center justify-center font-mono font-black neo-button text-sm"
                      >
                        {route.isReversed ? "←" : "→"}
                      </button>

                      {/* Destination */}
                      <div className="flex items-center space-x-2 text-right">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-lime-cream-400">{t("destination")}</div>
                          <div className="font-black uppercase text-lime-cream-200">{targetChat?.name}</div>
                        </div>
                        {route.targetPlatform === "vk" ? <VkIcon className="w-6 h-6" /> : <TelegramIcon className="w-6 h-6" />}
                      </div>
                    </div>

                    {/* GSAP Run Animation inside Preview inside conveyor pipe */}
                    <MessageFlowAnimation 
                      direction={flowDirection} 
                      sourcePlatform={route.isReversed ? route.targetPlatform : route.sourcePlatform}
                      isMoving={true} 
                      padding={12}
                      iconSize={24}
                      bgClass="bg-yale-blue-900"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "chats" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VK Column */}
            <div className="p-4 bg-yale-blue-950 border-2 border-black flex flex-col space-y-3">
              <div className="flex items-center space-x-2 border-b border-black pb-2">
                <VkIcon className="w-5 h-5" />
                <h4 className="font-black text-sm uppercase text-lime-cream-100">VKontakte</h4>
              </div>
              <div className="space-y-2">
                {chats.filter(c => c.platform === "vk").map(chat => (
                  <div key={chat.id} className="p-2.5 bg-yale-blue-900 border border-black flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-lime-cream-200">{chat.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{chat.externalId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telegram Column */}
            <div className="p-4 bg-yale-blue-950 border-2 border-black flex flex-col space-y-3">
              <div className="flex items-center space-x-2 border-b border-black pb-2">
                <TelegramIcon className="w-5 h-5" />
                <h4 className="font-black text-sm uppercase text-lime-cream-100">Telegram</h4>
              </div>
              <div className="space-y-2">
                {chats.filter(c => c.platform === "tg").map(chat => (
                  <div key={chat.id} className="p-2.5 bg-yale-blue-900 border border-black flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-lime-cream-200">{chat.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{chat.externalId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA Footer */}
      <div className="mt-8 flex justify-center border-t-2 border-black pt-6">
        <Link 
          href="/login" 
          className="px-6 py-3 bg-lime-cream-400 text-black font-black uppercase tracking-wider border-2 border-black neo-button text-xs hover:bg-lime-cream-300"
        >
          Configure Live Pipelines &rarr;
        </Link>
      </div>
    </div>
  );
}
