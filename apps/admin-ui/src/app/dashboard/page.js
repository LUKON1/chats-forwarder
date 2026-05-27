"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TelegramIcon from "@/assets/icons/TelegramIcon";
import VkIcon from "@/assets/icons/VkIcon";
import MessageFlowAnimation from "@/components/MessageFlowAnimation";
import { useLanguage } from "@/context/LanguageContext";

const API_URL = typeof process.env.NEXT_PUBLIC_API_URL === "string" ? process.env.NEXT_PUBLIC_API_URL : "http://localhost:4000";

export default function Dashboard() {
  const { push } = useRouter();
  const { locale, t, changeLocale } = useLanguage();
  const [activeTab, setActiveTab] = useState("routes");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /* Real database state for chats and routes */
  const [chats, setChats] = useState([]);
  const [routes, setRoutes] = useState([]);

  /* API connection state */
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  /* Onboarding Pin Code Generation */
  const [codePlatform, setCodePlatform] = useState("vk");
  const [generatedCode, setGeneratedCode] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  /* Form states for adding routes */
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [newRouteTitle, setNewRouteTitle] = useState("");
  const [newRouteSource, setNewRouteSource] = useState("");
  const [newRouteTarget, setNewRouteTarget] = useState("");
  const [newRouteDirection, setNewRouteDirection] = useState("vk-to-tg");

  /* Handle log out */
  const handleLogout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
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
    push("/login");
  }, [push]);

  // Helper to fetch with automatic token refresh
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    let token = localStorage.getItem("token");
    if (!options.headers) {
      options.headers = {};
    }
    options.headers["Authorization"] = `Bearer ${token}`;

    let res = await fetch(url, options);

    if (res.status === 401) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        handleLogout();
        throw new Error("Unauthorized");
      }

      try {
        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          localStorage.setItem("token", refreshData.accessToken);
          
          // Retry the request with the new access token
          options.headers["Authorization"] = `Bearer ${refreshData.accessToken}`;
          res = await fetch(url, options);
        } else {
          handleLogout();
          throw new Error("Session expired");
        }
      } catch (err) {
        handleLogout();
        throw err;
      }
    }

    return res;
  }, [handleLogout]);

  // Load chats and pipelines from bot engine API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setApiError("");
    try {
      // 1. Fetch connected chats pool
      const chatsRes = await fetchWithAuth(`${API_URL}/api/chats`);
      
      // 2. Fetch forwarding pipelines (bridges)
      const bridgesRes = await fetchWithAuth(`${API_URL}/api/bridges`);

      if (!chatsRes.ok || !bridgesRes.ok) {
        throw new Error("Failed to load dashboard data from API");
      }

      const chatsData = await chatsRes.json();
      const bridgesData = await bridgesRes.json();

      // Transform backend chats {vk: [], tg: []} to UI flat array format
      const flatChats = [
        ...(chatsData.vk || []).map((c) => ({ id: c.chat_id, name: c.title, platform: "vk", externalId: String(c.chat_id) })),
        ...(chatsData.tg || []).map((c) => ({ id: c.chat_id, name: c.title, platform: "tg", externalId: String(c.chat_id) }))
      ];
      setChats(flatChats);

      // Transform backend bridges to UI route format
      const mappedRoutes = (bridgesData || []).map((r) => ({
        id: r.id,
        title: r.title || `${r.source_platform.toUpperCase()} -> ${r.target_platform.toUpperCase()}`,
        sourceId: r.source_chat_id,
        targetId: r.target_chat_id,
        direction: `${r.source_platform}-to-${r.target_platform}`,
        isActive: r.is_active === 1
      }));
      setRoutes(mappedRoutes);
    } catch (err) {
      console.error(err);
      setApiError(t("cannot_connect_api"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, t]);

  // Validate authentication and fetch data on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in");
    const token = localStorage.getItem("token");

    if (!loggedIn || !token) {
      push("/login");
    } else {
      setIsAuthenticated(true);
      loadData();
    }
  }, [push, loadData]);

  /* Generate temporary onboarding PIN for connecting chats */
  const handleGenerateCode = async (e) => {
    e.preventDefault();
    setGeneratedCode(null);
    setGeneratingCode(true);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/connect/code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ platform: codePlatform })
      });

      const data = await res.json();
      if (res.ok && data.code) {
        setGeneratedCode(data.code);
      } else {
        alert(data.error || "Failed to generate code");
      }
    } catch (err) {
      console.error(err);
      alert("API server connection failed");
    } finally {
      setGeneratingCode(false);
    }
  };

  /* Disconnect chat from pool */
  const handleDeleteChat = async (platform, chatId) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/chats/${platform}/${chatId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to disconnect chat");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Add new routing pipeline */
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!newRouteTitle || !newRouteSource || !newRouteTarget) return;

    try {
      const res = await fetchWithAuth(`${API_URL}/api/bridges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newRouteTitle,
          source_platform: newRouteDirection === "vk-to-tg" ? "vk" : "tg",
          source_chat_id: Number(newRouteSource),
          target_platform: newRouteDirection === "vk-to-tg" ? "tg" : "vk",
          target_chat_id: Number(newRouteTarget),
          show_author: true
        })
      });

      if (res.ok) {
        setIsCreatingRoute(false);
        setNewRouteTitle("");
        setNewRouteSource("");
        setNewRouteTarget("");
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create pipeline");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Toggle bridge active status */
  const handleToggleRoute = async (id, currentActive) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/bridges/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          is_active: currentActive ? 0 : 1
        })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Reverse bridge direction flow */
  const handleReverseDirection = async (route) => {
    const newSourcePlatform = route.direction === "vk-to-tg" ? "tg" : "vk";
    const newTargetPlatform = route.direction === "vk-to-tg" ? "vk" : "tg";

    try {
      const res = await fetchWithAuth(`${API_URL}/api/bridges/${route.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source_platform: newSourcePlatform,
          source_chat_id: route.targetId,
          target_platform: newTargetPlatform,
          target_chat_id: route.sourceId
        })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Delete bridge */
  const handleDeleteRoute = async (id) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/bridges/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-yale-blue-950 text-lime-cream-50 font-mono">
        {t("loading_auth_state")}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-yale-blue-950 text-lime-cream-50 font-sans relative">
      <div className="looping-bg-grid" />

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b-4 border-black bg-yale-blue-900 z-10 gap-4 flex-wrap">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-lime-cream-400 border-2 border-black flex items-center justify-center font-mono font-bold text-black text-lg shadow-[2px_2px_0px_#000]">
            {t("logo")}
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-lime-cream-100">
            {t("title")}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Language Switcher Dropdown */}
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

          <button
            onClick={handleLogout}
            type="button"
            className="px-4 py-2 bg-rose-900 border-2 border-black text-sm font-bold uppercase tracking-wider neo-button text-lime-cream-100"
          >
            {t("logout")}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="grow max-w-5xl w-full mx-auto p-6 md:p-10 z-10 flex flex-col">
        {apiError && (
          <div className="bg-rose-900 border-4 border-black text-lime-cream-50 text-sm font-mono p-4 mb-8 shadow-[4px_4px_0px_#000]">
            {t("error_label")}: {apiError}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b-4 border-black mb-10 space-x-2 text-sm font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab("routes")}
            type="button"
            className={`px-6 py-3 border-t-2 border-x-2 border-black transition-transform duration-75 ${
              activeTab === "routes"
                ? "bg-lime-cream-400 text-black border-b-4 border-b-lime-cream-400 translate-y-1"
                : "bg-yale-blue-900 text-lime-cream-300 hover:text-lime-cream-50"
            }`}
          >
            {t("routes_tab")}
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            type="button"
            className={`px-6 py-3 border-t-2 border-x-2 border-black transition-transform duration-75 ${
              activeTab === "chats"
                ? "bg-lime-cream-400 text-black border-b-4 border-b-lime-cream-400 translate-y-1"
                : "bg-yale-blue-900 text-lime-cream-300 hover:text-lime-cream-50"
            }`}
          >
            {t("chats_tab")}
          </button>
        </div>

        {/* Tab content */}
        <div className="grow">
          {isLoading ? (
            <div className="neo-box p-12 bg-yale-blue-900 text-center font-mono text-lime-cream-300">
              {t("sync_with_api")}
            </div>
          ) : (
            <>
              {/* Tab 1: Routes */}
              {activeTab === "routes" && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b-2 border-black pb-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase text-lime-cream-200">{t("active_routes")}</h2>
                      <p className="text-xs text-lime-cream-400 font-mono mt-1">{t("total_routes")}: {routes.length}</p>
                    </div>
                    <button
                      onClick={() => setIsCreatingRoute(!isCreatingRoute)}
                      type="button"
                      className="px-5 py-3 bg-tropical-teal-500 text-black text-sm font-black uppercase tracking-wider border-2 border-black neo-button"
                    >
                      {isCreatingRoute ? t("close") : t("create_route")}
                    </button>
                  </div>

                  {/* Create Route form */}
                  {isCreatingRoute && (
                    <form onSubmit={handleCreateRoute} className="neo-box p-6 bg-yale-blue-900 space-y-6">
                      <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 text-lime-cream-200">
                        {t("config_pipeline")}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("pipeline_name")}
                          </label>
                          <input
                            type="text"
                            value={newRouteTitle}
                            onChange={(e) => setNewRouteTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
                            placeholder={t("placeholder_pipeline_name")}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("direction_flow")}
                          </label>
                          <select
                            value={newRouteDirection}
                            onChange={(e) => {
                              setNewRouteDirection(e.target.value);
                              setNewRouteSource("");
                              setNewRouteTarget("");
                            }}
                            className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none appearance-none"
                          >
                            <option value="vk-to-tg">{t("direction_vk_to_tg")}</option>
                            <option value="tg-to-vk">{t("direction_tg_to_vk")}</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("source_chat")}
                          </label>
                          <select
                            value={newRouteSource}
                            onChange={(e) => setNewRouteSource(e.target.value)}
                            className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
                            required
                          >
                            <option value="">{t("choose_source")}</option>
                            {chats
                              .filter((c) => c.platform === (newRouteDirection === "vk-to-tg" ? "vk" : "tg"))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.externalId})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("target_chat")}
                          </label>
                          <select
                            value={newRouteTarget}
                            onChange={(e) => setNewRouteTarget(e.target.value)}
                            className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none"
                            required
                          >
                            <option value="">{t("choose_target")}</option>
                            {chats
                              .filter((c) => c.platform === (newRouteDirection === "vk-to-tg" ? "tg" : "vk"))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.externalId})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-6 py-3 bg-lime-cream-400 text-black font-black uppercase tracking-wider border-2 border-black neo-button"
                        >
                          {t("save_pipeline")}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Empty state when no routes configured */}
                  {routes.length === 0 && (
                    <div className="neo-box p-12 bg-yale-blue-900 text-center space-y-4">
                      <h3 className="text-xl font-bold uppercase text-lime-cream-300">{t("no_pipelines")}</h3>
                      <p className="text-lime-cream-400 max-w-md mx-auto text-sm">
                        {t("no_pipelines_desc")}
                      </p>
                      <button 
                        onClick={() => setIsCreatingRoute(true)}
                        type="button"
                        className="px-4 py-2.5 bg-tropical-teal-500 text-black font-bold uppercase border-2 border-black neo-button text-xs"
                      >
                        {t("add_first_route")}
                      </button>
                    </div>
                  )}

                  {/* Routes List */}
                  <div className="space-y-6">
                    {routes.map((route) => {
                      const sourceChat = chats.find((c) => c.platform === (route.direction === "vk-to-tg" ? "vk" : "tg") && c.id === route.sourceId);
                      const targetChat = chats.find((c) => c.platform === (route.direction === "vk-to-tg" ? "tg" : "vk") && c.id === route.targetId);

                      return (
                        <div key={route.id} className="neo-box bg-yale-blue-900 flex flex-col relative overflow-hidden">
                          {/* Top state accent bar */}
                          <div className={`h-2 border-b-2 border-black ${route.isActive ? "bg-lime-cream-400" : "bg-zinc-600"}`} />
                          
                          <div className="p-6 space-y-6">
                            {/* Header Details */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div>
                                <h3 className="text-lg font-black uppercase text-lime-cream-200">
                                  {route.title}
                                </h3>
                              </div>
                              
                              {/* Top Controls */}
                              <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                                <button
                                  onClick={() => handleToggleRoute(route.id, route.isActive)}
                                  type="button"
                                  className={`Neo-button px-4 py-2 border-2 border-black text-xs font-black uppercase tracking-wider ${
                                    route.isActive 
                                      ? "bg-lime-cream-400 text-black" 
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {route.isActive ? t("active") : t("paused")}
                                </button>
                                <button
                                  onClick={() => handleDeleteRoute(route.id)}
                                  type="button"
                                  className="px-4 py-2 bg-rose-900 border-2 border-black text-xs font-black uppercase tracking-wider neo-button text-lime-cream-100"
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            </div>

                            {/* Pipeline Node visualization with Direction Arrow and GSAP Animation */}
                            <div className="space-y-4">
                              <div className="flex justify-between items-center bg-yale-blue-950 p-4 border-2 border-black">
                                {/* Left Platform Node */}
                                <div className="flex items-center space-x-3">
                                  {route.direction === "vk-to-tg" ? (
                                    <VkIcon className="w-8 h-8" />
                                  ) : (
                                    <TelegramIcon className="w-8 h-8" />
                                  )}
                                  <div>
                                    <div className="text-xs font-bold uppercase tracking-wide text-lime-cream-400">{t("source")}</div>
                                    <div className="text-sm font-black uppercase text-lime-cream-200">
                                      {sourceChat ? sourceChat.name : t("chat_deleted")}
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-500">
                                      {sourceChat ? sourceChat.externalId : t("none")}
                                    </div>
                                  </div>
                                </div>

                                {/* Center interactive reverse direction button */}
                                <button
                                  onClick={() => handleReverseDirection(route)}
                                  type="button"
                                  title="⇅"
                                  className="w-10 h-10 bg-tropical-teal-500 text-black border-2 border-black flex items-center justify-center font-mono font-black neo-button text-lg"
                                >
                                  ⇅
                                </button>

                                {/* Right Platform Node */}
                                <div className="flex items-center space-x-3 text-right">
                                  <div>
                                    <div className="text-xs font-bold uppercase tracking-wide text-lime-cream-400">{t("destination")}</div>
                                    <div className="text-sm font-black uppercase text-lime-cream-200">
                                      {targetChat ? targetChat.name : t("chat_deleted")}
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-500">
                                      {targetChat ? targetChat.externalId : t("none")}
                                    </div>
                                  </div>
                                  {route.direction === "vk-to-tg" ? (
                                    <TelegramIcon className="w-8 h-8" />
                                  ) : (
                                    <VkIcon className="w-8 h-8" />
                                  )}
                                </div>
                              </div>

                              {/* Message Flow visual animation running Dog/Bird */}
                              <MessageFlowAnimation 
                                direction={route.direction} 
                                isMoving={route.isActive} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Chats Pool */}
              {activeTab === "chats" && (
                <div className="space-y-10">
                  {/* Connected Chats grid list */}
                  <div className="space-y-6">
                    <div className="border-b-2 border-black pb-4">
                      <h2 className="text-2xl font-black uppercase text-lime-cream-200">{t("chats_tab")}</h2>
                      <p className="text-xs text-lime-cream-400 font-mono mt-1">
                        {t("chats_pool_desc")}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* VKontakte column */}
                      <div className="neo-box p-6 bg-yale-blue-900 flex flex-col space-y-4">
                        <div className="flex items-center space-x-2 border-b-2 border-black pb-3">
                          <VkIcon className="w-6 h-6" />
                          <h3 className="text-lg font-black uppercase text-lime-cream-100">VKontakte</h3>
                        </div>

                        {chats.filter((c) => c.platform === "vk").length === 0 ? (
                          <p className="text-xs text-zinc-500 py-6 text-center font-mono">{t("no_vk_chats")}</p>
                        ) : (
                          <div className="space-y-3">
                            {chats
                              .filter((c) => c.platform === "vk")
                              .map((chat) => (
                                <div key={chat.id} className="p-4 bg-yale-blue-950 border-2 border-black flex justify-between items-center">
                                  <div>
                                    <h4 className="font-bold text-lime-cream-200">{chat.name}</h4>
                                    <span className="text-[10px] font-mono text-zinc-500">{chat.externalId}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteChat("vk", chat.id)}
                                    type="button"
                                    className="px-3 py-1.5 bg-rose-900 border-2 border-black text-[10px] font-bold uppercase neo-button text-lime-cream-100"
                                  >
                                    {t("remove")}
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Telegram column */}
                      <div className="neo-box p-6 bg-yale-blue-900 flex flex-col space-y-4">
                        <div className="flex items-center space-x-2 border-b-2 border-black pb-3">
                          <TelegramIcon className="w-6 h-6" />
                          <h3 className="text-lg font-black uppercase text-lime-cream-100">Telegram</h3>
                        </div>

                        {chats.filter((c) => c.platform === "tg").length === 0 ? (
                          <p className="text-xs text-zinc-500 py-6 text-center font-mono">{t("no_tg_chats")}</p>
                        ) : (
                          <div className="space-y-3">
                            {chats
                              .filter((c) => c.platform === "tg")
                              .map((chat) => (
                                <div key={chat.id} className="p-4 bg-yale-blue-950 border-2 border-black flex justify-between items-center">
                                  <div>
                                    <h4 className="font-bold text-lime-cream-200">{chat.name}</h4>
                                    <span className="text-[10px] font-mono text-zinc-500">{chat.externalId}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteChat("tg", chat.id)}
                                    type="button"
                                    className="px-3 py-1.5 bg-rose-900 border-2 border-black text-[10px] font-bold uppercase neo-button text-lime-cream-100"
                                  >
                                    {t("remove")}
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connect new chat block (Onboarding PIN generation) */}
                  <div className="neo-box p-6 bg-yale-blue-900 space-y-6">
                    <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 text-lime-cream-200">
                      {t("connect_new_chat")}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Generation form */}
                      <form onSubmit={handleGenerateCode} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("select_platform_code")}
                          </label>
                          <select
                            value={codePlatform}
                            onChange={(e) => setCodePlatform(e.target.value)}
                            className="w-full px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 rounded-none appearance-none"
                          >
                            <option value="vk">VKontakte</option>
                            <option value="tg">Telegram</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={generatingCode}
                          className="px-6 py-3 bg-lime-cream-400 text-black font-black uppercase tracking-wider border-2 border-black neo-button text-sm w-full md:w-auto"
                        >
                          {generatingCode ? t("generating") : t("generate_code_btn")}
                        </button>
                      </form>

                      {/* Display сode */}
                      {generatedCode && (
                        <div className="p-5 bg-yale-blue-950 border-2 border-black flex flex-col justify-center space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-lime-cream-400">
                            {t("your_code")}:
                          </div>
                          <div className="font-mono text-3xl font-black tracking-widest text-tropical-teal-400 bg-black py-2 px-4 border border-zinc-800 text-center select-all">
                            {generatedCode}
                          </div>
                          <p className="text-[11px] font-medium text-lime-cream-300 leading-relaxed pt-1">
                            {t("code_instruction")} <span className="font-mono bg-black text-lime-cream-100 px-1 border border-zinc-800">/connect {generatedCode}</span>
                          </p>
                          <div className="text-[10px] text-zinc-500 font-mono pt-1">
                            * {t("code_expires")}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black py-6 bg-yale-blue-900 text-center font-mono text-xs text-lime-cream-400 mt-auto">
        {t("footer_panel")}
      </footer>
    </div>
  );
}
