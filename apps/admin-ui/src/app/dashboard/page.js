"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import TelegramIcon from "@/assets/icons/TelegramIcon";
import VkIcon from "@/assets/icons/VkIcon";
import LinkArrowIcon from "@/assets/icons/LinkArrowIcon";
import MessageFlowAnimation from "@/components/MessageFlowAnimation";
import { useLanguage } from "@/context/LanguageContext";
import Dropdown from "@/components/Dropdown";
import { gsap } from "gsap";
import FlowArrowIcon from "@/assets/icons/FlowArrowIcon";

const platformOptions = [
  {
    id: "vk",
    name: "VKontakte",
    handle: "Chats Forwarder",
    url: "https://vk.com/club239265109",
    Icon: VkIcon,
    bgClass: "fill-cerulean-600",
    accent: "bg-cerulean-600",
    border: "border-cerulean-600",
    hoverBg: "hover:bg-cerulean-950/20"
  },
  {
    id: "tg",
    name: "Telegram",
    handle: "@chatsForwarderbot",
    url: "https://t.me/chatsForwarderbot",
    Icon: TelegramIcon,
    bgClass: "fill-cerulean-500",
    accent: "bg-cerulean-500",
    border: "border-cerulean-500",
    hoverBg: "hover:bg-cerulean-950/20"
  }
];

export default function Dashboard() {
  const { push } = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("routes");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const tabContentRef = useRef(null);
  const modalRef = useRef(null);
  const modalDialogRef = useRef(null);

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

  /* Modal configuration state */
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Copy PIN code to clipboard
  const handleCopyCode = useCallback(() => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  }, [generatedCode]);

  // Copy full telegram connect command to clipboard
  const handleCopyCommand = useCallback(() => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(`/connect ${generatedCode}`);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 1500);
  }, [generatedCode]);

  // Smooth page and tab transitions on activeTab/isLoading changes
  useEffect(() => {
    if (isLoading) return;

    gsap.fromTo(tabContentRef.current,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
    );

    gsap.fromTo(".route-card, .chats-column",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out", delay: 0.1 }
    );
  }, [activeTab, isLoading]);

  // Smooth dropdown height/fade entrance for form creation
  useEffect(() => {
    if (isCreatingRoute) {
      gsap.fromTo(".create-route-form",
        { height: 0, opacity: 0, y: -20, overflow: "hidden" },
        { height: "auto", opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "overflow,height" }
      );
    }
  }, [isCreatingRoute]);

  // Handle modal opening and closing animation using GSAP
  useEffect(() => {
    if (!modalRef.current || !modalDialogRef.current) return;

    if (modalConfig.isOpen) {
      const tl = gsap.timeline();
      tl.to(modalRef.current, {
        autoAlpha: 1,
        duration: 0.3,
        ease: "power2.out"
      });
      tl.to(modalDialogRef.current, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.4,
        ease: "back.out(1.5)"
      }, "-=0.15");
    } else {
      const tl = gsap.timeline();
      tl.to(modalDialogRef.current, {
        opacity: 0,
        scale: 0.9,
        y: 20,
        duration: 0.3,
        ease: "power2.in"
      });
      tl.to(modalRef.current, {
        autoAlpha: 0,
        duration: 0.25,
        ease: "power2.in"
      }, "-=0.15");
    }
  }, [modalConfig.isOpen]);

  /* Show custom notification/error modal */
  const showModal = useCallback((title, message, type = "info") => {
    setModalConfig({ isOpen: true, title, message, type });
  }, []);

  /* Handle log out */
  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
    } catch (err) {
      console.error("Failed to notify server about logout:", err);
    }
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("token");
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
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
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
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setApiError("");
    try {
      // 1. Fetch connected chats pool
      const chatsRes = await fetchWithAuth("/api/chats");
      
      // 2. Fetch forwarding pipelines (bridges)
      const bridgesRes = await fetchWithAuth("/api/bridges");

      if (!chatsRes.ok || !bridgesRes.ok) {
        throw new Error("Failed to load dashboard data from API");
      }

      const chatsData = await chatsRes.json();
      const bridgesData = await bridgesRes.json();

      // Transform backend chats {vk: [], tg: []} to UI flat array format
      const flatChats = [
        ...(chatsData.vk || []).map((c) => ({ id: c.chatId, name: c.title, platform: "vk", externalId: String(c.chatId) })),
        ...(chatsData.tg || []).map((c) => ({ id: c.chatId, name: c.title, platform: "tg", externalId: String(c.chatId) }))
      ];
      setChats(flatChats);

      // Transform backend bridges to UI route format
      const mappedRoutes = (bridgesData || []).map((r) => ({
        id: r.id,
        title: r.title || `${r.sourcePlatform.toUpperCase()} -> ${r.targetPlatform.toUpperCase()}`,
        sourceId: r.sourceChatId,
        sourcePlatform: r.sourcePlatform,
        targetId: r.targetChatId,
        targetPlatform: r.targetPlatform,
        isReversed: r.isReversed === true || r.isReversed === 1,
        isActive: r.isActive === true || r.isActive === 1,
        showAuthor: r.showAuthor == null ? true : (r.showAuthor === true || r.showAuthor === 1)
      }));
      setRoutes(mappedRoutes);
    } catch (err) {
      console.error(err);
      setApiError(t("cannot_connect_api"));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [fetchWithAuth, t]);

  // Validate authentication and fetch data on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("is_logged_in");
    const token = localStorage.getItem("token");

    if (!loggedIn || !token) {
      push("/login");
    } else {
      /* Defer state updates to avoid synchronous cascading renders */
      setTimeout(() => {
        setIsAuthenticated(true);
        loadData();
      }, 0);
    }
  }, [push, loadData]);

  // Poll connected chats when onboarding code is active to update UI automatically
  useEffect(() => {
    if (!generatedCode) return;

    const initialChatsCount = chats.length;

    const interval = setInterval(async () => {
      try {
        const chatsRes = await fetchWithAuth("/api/chats");
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          const currentCount = (chatsData.vk || []).length + (chatsData.tg || []).length;
          
          if (currentCount > initialChatsCount) {
            loadData(true);
            setGeneratedCode(null);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling chats failed:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [generatedCode, chats.length, fetchWithAuth, loadData]);

  /* Generate temporary onboarding PIN for connecting chats */
  const handleGenerateCode = async (e) => {
    e.preventDefault();
    setGeneratedCode(null);
    setGeneratingCode(true);

    try {
      const res = await fetchWithAuth("/api/connect/code", {
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
        showModal(t("error_label"), t(data.error || "Failed to generate code"), "error");
      }
    } catch (err) {
      console.error(err);
      showModal(t("error_label"), t("API server connection failed"), "error");
    } finally {
      setGeneratingCode(false);
    }
  };

  /* Disconnect chat from pool */
  const handleDeleteChat = async (platform, chatId) => {
    try {
      const res = await fetchWithAuth(`/api/chats/${platform}/${chatId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadData(true);
      } else {
        const data = await res.json();
        showModal(t("error_label"), t(data.error || "Failed to disconnect chat"), "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Add new routing pipeline */
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!newRouteTitle || !newRouteSource || !newRouteTarget) return;

    const [sourcePlatform, sourceId] = newRouteSource.split(":");
    const [targetPlatform, targetId] = newRouteTarget.split(":");

    try {
      const res = await fetchWithAuth("/api/bridges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newRouteTitle,
          sourcePlatform: sourcePlatform,
          sourceChatId: Number(sourceId),
          targetPlatform: targetPlatform,
          targetChatId: Number(targetId),
          showAuthor: true
        })
      });

      if (res.ok) {
        setIsCreatingRoute(false);
        setNewRouteTitle("");
        setNewRouteSource("");
        setNewRouteTarget("");
        loadData(true);
      } else {
        const data = await res.json();
        showModal(t("error_label"), t(data.error || "Failed to create pipeline"), "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Reverse bridge direction flow by toggling is_reversed flag */
  const handleReverseDirection = async (route) => {
    try {
      const res = await fetchWithAuth(`/api/bridges/${route.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isReversed: !route.isReversed
        })
      });
      if (res.ok) {
        loadData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Toggle sender name prefix forwarding setting */
  const handleToggleShowAuthor = async (route) => {
    try {
      const res = await fetchWithAuth(`/api/bridges/${route.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          showAuthor: !route.showAuthor
        })
      });
      if (res.ok) {
        loadData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /* Delete bridge */
  const handleDeleteRoute = async (id) => {
    try {
      const res = await fetchWithAuth(`/api/bridges/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sourceChatOptions = chats.map((c) => ({
    value: `${c.platform}:${c.id}`,
    label: `${c.platform === "vk" ? "VK" : "Telegram"}: ${c.name}`
  }));

  const targetChatOptions = chats
    .filter((c) => !newRouteSource || `${c.platform}:${c.id}` !== newRouteSource)
    .map((c) => ({
      value: `${c.platform}:${c.id}`,
      label: `${c.platform === "vk" ? "VK" : "Telegram"}: ${c.name}`
    }));

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-yale-blue-950 text-lime-cream-50 font-mono">
        {t("loading_auth_state")}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow bg-yale-blue-950 text-lime-cream-50 font-sans relative">
      <div className="looping-bg-grid" />

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
        <div ref={tabContentRef} className="grow">
          {isLoading ? (
            <div className="neo-box p-12 bg-yale-blue-900 text-center font-mono text-lime-cream-300">
              {t("sync_with_api")}
            </div>
          ) : (
            <>
              {/* Tab 1: Routes */}
              {activeTab === "routes" && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase text-lime-cream-200">{t("active_routes")}</h2>
                      <p className="text-xs text-lime-cream-400 font-mono mt-1">{t("total_routes")}: {routes.length}</p>
                    </div>
                    <button
                      onClick={() => setIsCreatingRoute(!isCreatingRoute)}
                      type="button"
                      className="w-full sm:w-auto px-5 py-3 bg-tropical-teal-500 text-black text-sm font-black uppercase tracking-wider border-2 border-black neo-button text-center"
                    >
                      {isCreatingRoute ? t("close") : t("create_route")}
                    </button>
                  </div>

                  {/* Create Route form */}
                  {isCreatingRoute && (
                    <form onSubmit={handleCreateRoute} className="neo-box p-6 bg-yale-blue-900 space-y-6 create-route-form">
                      <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 text-lime-cream-200">
                        {t("config_pipeline")}
                      </h3>
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
 
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("source_chat")}
                          </label>
                          <Dropdown
                            value={newRouteSource}
                            onChange={(val) => setNewRouteSource(val)}
                            options={sourceChatOptions}
                            placeholder={t("choose_source")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300 mb-2">
                            {t("target_chat")}
                          </label>
                          <Dropdown
                            value={newRouteTarget}
                            onChange={(val) => setNewRouteTarget(val)}
                            options={targetChatOptions}
                            placeholder={t("choose_target")}
                          />
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
                      const sourceChat = chats.find((c) => c.platform === route.sourcePlatform && c.id === route.sourceId);
                      const targetChat = chats.find((c) => c.platform === route.targetPlatform && c.id === route.targetId);
                      const flowDirection = route.isReversed ? "right-to-left" : "left-to-right";

                      return (
                        <div key={route.id} className="neo-box bg-yale-blue-900 flex flex-col relative overflow-hidden route-card">
                          {/* Top state accent bar */}
                          <div className="h-2 border-b-2 border-black bg-lime-cream-400" />
                          
                          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                            {/* Header Details */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div>
                                <h3 className="text-lg font-black uppercase text-lime-cream-200">
                                  {route.title}
                                </h3>
                              </div>
                              
                              {/* Top Controls */}
                              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                                <button
                                  onClick={() => handleToggleShowAuthor(route)}
                                  type="button"
                                  className={`px-4 py-2 border-2 border-black text-xs font-black uppercase tracking-wider neo-button ${
                                    route.showAuthor
                                      ? "bg-tropical-teal-500 text-black"
                                      : "bg-yale-blue-950 text-zinc-400"
                                  }`}
                                >
                                  {route.showAuthor ? t("author_shown") : t("author_hidden")}
                                </button>
                                <div className="bg-lime-cream-400 text-black border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider select-none">
                                  {t("active")}
                                </div>
                                <button
                                  onClick={() => handleDeleteRoute(route.id)}
                                  type="button"
                                  className="px-4 py-2 bg-rose-900 border-2 border-black text-xs font-black uppercase tracking-wider neo-button text-lime-cream-100"
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            </div>

                            {/* Pipeline Node visualization with U-shape Conveyor Animation */}
                            <div className="relative pb-28">
                              <div className="flex justify-between items-center bg-yale-blue-950 p-2.5 sm:p-4 border-2 border-black relative z-20 min-w-0 gap-2">
                                {/* Left Platform Node */}
                                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                                  {route.sourcePlatform === "vk" ? (
                                    <VkIcon className="w-8 h-8 flex-shrink-0" />
                                  ) : (
                                    <TelegramIcon className="w-8 h-8 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wide text-lime-cream-400">{t("source")}</div>
                                    <div className="text-xs sm:text-sm font-black uppercase text-lime-cream-200 truncate max-w-[80px] min-[380px]:max-w-[120px] sm:max-w-[200px] md:max-w-none">
                                      {sourceChat ? sourceChat.name : t("chat_deleted")}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-mono text-zinc-500 truncate max-w-[80px] min-[380px]:max-w-[120px] sm:max-w-[200px] md:max-w-none">
                                      {sourceChat ? sourceChat.externalId : t("none")}
                                    </div>
                                  </div>
                                </div>

                                {/* Center interactive reverse direction button */}
                                <button
                                  onClick={() => handleReverseDirection(route)}
                                  type="button"
                                  title={t("reverse_direction")}
                                  className="w-10 h-10 bg-tropical-teal-500 text-black border-2 border-black flex items-center justify-center neo-button flex-shrink-0"
                                >
                                  <FlowArrowIcon reversed={route.isReversed} className="w-6 h-6" />
                                </button>

                                {/* Right Platform Node */}
                                <div className="flex items-center space-x-2 sm:space-x-3 text-right min-w-0">
                                  <div className="min-w-0">
                                    <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wide text-lime-cream-400">{t("destination")}</div>
                                    <div className="text-xs sm:text-sm font-black uppercase text-lime-cream-200 truncate max-w-[80px] min-[380px]:max-w-[120px] sm:max-w-[200px] md:max-w-none">
                                      {targetChat ? targetChat.name : t("chat_deleted")}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-mono text-zinc-500 truncate max-w-[80px] min-[380px]:max-w-[120px] sm:max-w-[200px] md:max-w-none">
                                      {targetChat ? targetChat.externalId : t("none")}
                                    </div>
                                  </div>
                                  {route.targetPlatform === "vk" ? (
                                    <VkIcon className="w-8 h-8 flex-shrink-0" />
                                  ) : (
                                    <TelegramIcon className="w-8 h-8 flex-shrink-0" />
                                  )}
                                </div>
                              </div>

                              {/* Message Flow visual animation running Dog/Bird inside U-shape pipe */}
                              <MessageFlowAnimation 
                                direction={flowDirection} 
                                sourcePlatform={route.isReversed ? route.targetPlatform : route.sourcePlatform}
                                isMoving={true} 
                                padding={16}
                                iconSize={32}
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
                      <div className="neo-box p-4 sm:p-6 bg-yale-blue-900 flex flex-col space-y-4 chats-column">
                        <div className="flex items-center space-x-2 border-b-2 border-black pb-3">
                          <VkIcon className="w-6 h-6 flex-shrink-0" />
                          <h3 className="text-lg font-black uppercase text-lime-cream-100">VKontakte</h3>
                        </div>

                        {chats.filter((c) => c.platform === "vk").length === 0 ? (
                          <p className="text-xs text-zinc-500 py-6 text-center font-mono">{t("no_vk_chats")}</p>
                        ) : (
                          <div className="space-y-3">
                            {chats
                              .filter((c) => c.platform === "vk")
                              .map((chat) => (
                                <div key={chat.id} className="p-3 sm:p-4 bg-yale-blue-950 border-2 border-black flex justify-between items-center min-w-0 gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-lime-cream-200 truncate">{chat.name}</h4>
                                    <span className="text-[10px] font-mono text-zinc-500 block truncate">{chat.externalId}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteChat("vk", chat.id)}
                                    type="button"
                                    className="px-3 py-1.5 bg-rose-900 border-2 border-black text-[10px] font-bold uppercase neo-button text-lime-cream-100 flex-shrink-0"
                                  >
                                    {t("remove")}
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Telegram column */}
                      <div className="neo-box p-4 sm:p-6 bg-yale-blue-900 flex flex-col space-y-4 chats-column">
                        <div className="flex items-center space-x-2 border-b-2 border-black pb-3">
                          <TelegramIcon className="w-6 h-6 flex-shrink-0" />
                          <h3 className="text-lg font-black uppercase text-lime-cream-100">Telegram</h3>
                        </div>

                        {chats.filter((c) => c.platform === "tg").length === 0 ? (
                          <p className="text-xs text-zinc-500 py-6 text-center font-mono">{t("no_tg_chats")}</p>
                        ) : (
                          <div className="space-y-3">
                            {chats
                              .filter((c) => c.platform === "tg")
                              .map((chat) => (
                                <div key={chat.id} className="p-3 sm:p-4 bg-yale-blue-950 border-2 border-black flex justify-between items-center min-w-0 gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-lime-cream-200 truncate">{chat.name}</h4>
                                    <span className="text-[10px] font-mono text-zinc-500 block truncate">{chat.externalId}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteChat("tg", chat.id)}
                                    type="button"
                                    className="px-3 py-1.5 bg-rose-900 border-2 border-black text-[10px] font-bold uppercase neo-button text-lime-cream-100 flex-shrink-0"
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
                  <div className="neo-box p-4 sm:p-6 bg-yale-blue-900 space-y-6">
                    <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 text-lime-cream-200">
                      {t("connect_new_chat")}
                    </h3>

                    <div className="space-y-6">
                      {/* Step 1: Select platform */}
                      <div className="space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300">
                          {t("select_platform_label")}
                        </label>
                        
                        {/* Platform cards grid — scales naturally for more than 2 bots */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {platformOptions.map((platform) => {
                            const isSelected = codePlatform === platform.id;
                            const PlatformIcon = platform.Icon;
                            return (
                              <button
                                key={platform.id}
                                type="button"
                                onClick={() => {
                                  setCodePlatform(platform.id);
                                  setGeneratedCode(null);
                                }}
                                className={`flex items-center gap-3 p-4 bg-yale-blue-950 border-2 transition-all duration-150 text-left select-none rounded-none cursor-pointer ${
                                  isSelected
                                    ? "border-lime-cream-400 shadow-[4px_4px_0px_#000000] translate-y-0.5"
                                    : "border-black hover:border-lime-cream-600/50 hover:bg-yale-blue-900 active:translate-y-0.5"
                                }`}
                              >
                                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-yale-blue-900 border border-black/40">
                                  <PlatformIcon className="w-6 h-6" bgClass={platform.bgClass} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-mono tracking-widest text-lime-cream-600 uppercase">
                                    {t("active_messenger")}
                                  </div>
                                  <div className="font-bold text-sm text-lime-cream-100 truncate">
                                    {platform.name}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Bot quick link info panel */}
                        {(() => {
                          const selectedPlatform = platformOptions.find((p) => p.id === codePlatform);
                          if (!selectedPlatform) return null;
                          return (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-yale-blue-950/40 border border-zinc-800/80 text-xs text-lime-cream-300 gap-3 mt-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-tropical-teal-500 animate-pulse flex-shrink-0" />
                                <span className="truncate">
                                  {t("docs_bots_sub")}
                                </span>
                              </div>
                              <a
                                href={selectedPlatform.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-yale-blue-900 border border-black hover:border-lime-cream-400 text-lime-cream-200 hover:text-lime-cream-50 transition-all font-bold uppercase tracking-wider text-[10px] flex-shrink-0 select-none group"
                              >
                                <span>{t("open_bot_link")} ({selectedPlatform.name})</span>
                                <LinkArrowIcon className="w-3 h-3 text-lime-cream-500 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Step 2: Generate Connection Code */}
                      <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase tracking-wider text-lime-cream-300">
                          {t("generate_action_label")}
                        </label>
                        
                        <div>
                          <button
                            type="button"
                            onClick={handleGenerateCode}
                            disabled={generatingCode}
                            className={`px-6 py-3 font-black uppercase tracking-wider border-2 border-black text-sm select-none cursor-pointer transition-all duration-100 flex items-center justify-center gap-2 ${
                              generatingCode
                                ? "bg-yale-blue-900 text-zinc-400 cursor-not-allowed"
                                : "bg-lime-cream-400 text-black hover:bg-lime-cream-300 active:translate-y-0.5 shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000000]"
                            }`}
                          >
                            {generatingCode ? (
                              <>
                                <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
                                <span>{t("generating")}</span>
                              </>
                            ) : (
                              <span>{t("generate_code_btn")}</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Display generated code instructions */}
                      {generatedCode && (() => {
                        const selectedPlatform = platformOptions.find((p) => p.id === codePlatform);
                        return (
                          <div className="p-6 bg-yale-blue-950 border-2 border-black space-y-5 animate-[fadeIn_0.3s_ease-out]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* PIN Code Box */}
                              <div 
                                className={`p-4 border-2 transition-all duration-300 flex flex-col justify-between gap-3 ${
                                  copiedCode 
                                    ? "border-lime-cream-400 bg-lime-cream-950/10 shadow-[2px_2px_0px_#000]" 
                                    : "border-zinc-800 bg-black shadow-[4px_4px_0px_#000]"
                                }`}
                              >
                                <div>
                                  <div className="text-[10px] font-mono tracking-widest text-lime-cream-600 uppercase mb-1">
                                    {t("your_code")}
                                  </div>
                                  <div className="font-mono text-3xl font-black tracking-widest text-tropical-teal-400 select-all">
                                    {generatedCode.length === 6 
                                      ? `${generatedCode.slice(0, 3)} ${generatedCode.slice(3)}` 
                                      : generatedCode
                                    }
                                  </div>
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={handleCopyCode}
                                  className={`w-full py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                                    copiedCode
                                      ? "bg-lime-cream-400 text-black border-lime-cream-400"
                                      : "bg-yale-blue-900 border-black hover:border-lime-cream-400 hover:bg-yale-blue-800 text-lime-cream-200"
                                  }`}
                                >
                                  {copiedCode ? (
                                    <>
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      <span>{t("copied")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                      </svg>
                                      <span>{t("copy_code_btn")}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Command Box */}
                              <div 
                                className={`p-4 border-2 transition-all duration-300 flex flex-col justify-between gap-3 ${
                                  copiedCommand 
                                    ? "border-lime-cream-400 bg-lime-cream-950/10 shadow-[2px_2px_0px_#000]" 
                                    : "border-zinc-800 bg-black shadow-[4px_4px_0px_#000]"
                                }`}
                              >
                                <div>
                                  <div className="text-[10px] font-mono tracking-widest text-lime-cream-600 uppercase mb-1">
                                    {t("copy_cmd_btn")}
                                  </div>
                                  <div className="font-mono text-sm font-semibold text-lime-cream-100 select-all py-2.5 px-3 bg-yale-blue-950 border border-zinc-800 break-all">
                                    /connect {generatedCode}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleCopyCommand}
                                  className={`w-full py-2 border-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                                    copiedCommand
                                      ? "bg-lime-cream-400 text-black border-lime-cream-400"
                                      : "bg-yale-blue-900 border-black hover:border-lime-cream-400 hover:bg-yale-blue-800 text-lime-cream-200"
                                  }`}
                                >
                                  {copiedCommand ? (
                                    <>
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      <span>{t("copied")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                      </svg>
                                      <span>{t("copy_cmd_btn")}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Instructions */}
                            <div className="p-4 bg-yale-blue-900/50 border border-zinc-800 text-[11px] font-medium text-lime-cream-300 leading-relaxed space-y-2">
                              <p className="font-semibold uppercase tracking-wider text-lime-cream-500 text-[9px] font-mono">
                                Инструкция по подключению:
                              </p>
                              <p>
                                1. Добавьте бота {selectedPlatform ? selectedPlatform.handle : ""} в группу или канал в качестве администратора.
                              </p>
                              <p>
                                2. Отправьте боту команду в этом чате. Бот мгновенно зарегистрирует подключение, и чат появится в списке сверху.
                              </p>
                              <div className="text-[10px] text-zinc-500 font-mono pt-1">
                                * {t("code_expires")}
                              </div>
                            </div>

                            {/* Polling status indicator */}
                            <div className="flex items-center justify-center gap-2 p-3 bg-yale-blue-900 border-2 border-black/40 text-xs font-mono text-lime-cream-400 select-none">
                              <svg className="w-4 h-4 animate-spin text-tropical-teal-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span className="animate-pulse">{t("waiting_connection")}</span>
                            </div>
                          </div>
                        );
                      })()}
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

      {/* Neo-brutalist Modal */}
      <div 
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 invisible opacity-0"
      >
        <div 
          ref={modalDialogRef}
          className="w-full max-w-md bg-yale-blue-900 border-4 border-black p-6 shadow-[8px_8px_0px_#000] relative opacity-0 scale-90"
        >
          <div className={`absolute top-0 inset-x-0 h-2 border-b-2 border-black ${modalConfig.type === "error" ? "bg-rose-600" : "bg-tropical-teal-500"}`} />
          
          <h3 className="text-lg font-black uppercase text-lime-cream-100 mb-2 mt-2">
            {modalConfig.title}
          </h3>
          <p className="text-sm font-mono text-lime-cream-300 mb-6 whitespace-pre-line leading-relaxed">
            {modalConfig.message}
          </p>
          
          <div className="flex justify-end">
            <button
              onClick={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
              type="button"
              className="px-6 py-2.5 bg-lime-cream-400 text-black font-black uppercase tracking-wider border-2 border-black neo-button text-xs"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
