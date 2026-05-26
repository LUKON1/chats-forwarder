"use client";

import { createContext, useContext, useState, useEffect } from "react";

const LanguageContext = createContext();

const translations = {
  ru: {
    // Landing
    logo: "CF",
    title: "CHAT FORWARDER",
    signin: "Войти",
    signup: "Регистрация",
    smm_automation: "Автоматизация SMM",
    hero_headline: "Пересылка сообщений без задержек.",
    hero_sub: "Синхронизируйте чаты и каналы в реальном времени. Быстро, стабильно и с гибкой настройкой. На базе Bun и Next.js.",
    vk_group: "Группа VKontakte",
    tg_channel: "Канал Telegram",
    stream_active: "статус_потока: активен",
    origin: "Источник",
    delay: "Задержка",
    target: "Назначение",
    reliable_title: "100% Надежность",
    reliable_desc: "Сообщения, вложения и медиафайлы передаются мгновенно и без потерь.",
    flow_title: "Двусторонний поток",
    flow_desc: "Маршрутизация сообщений в любых направлениях. Полный контроль и гибкие правила пересылки.",
    footer_text: "2026 Chat Forwarder. Без рекламы и сбора данных.",
    dashboard_preview: "Панель управления",
    powered_by: "На базе Taste Skill",
    
    // Auth
    sys_auth: "Системная авторизация",
    error_label: "ОШИБКА",
    success_label: "УСПЕХ",
    username: "Имя пользователя",
    password: "Пароль",
    email: "Электронная почта",
    confirm_password: "Подтвердите пароль",
    login_btn: "Войти",
    register_btn: "Создать аккаунт",
    first_time: "Впервые здесь?",
    already_registered: "Уже зарегистрированы?",
    signin_here: "Войти здесь",
    register_title: "Регистрация аккаунта",
    redirecting: "Перенаправление…",
    pw_mismatch: "Пароли не совпадают",
    invalid_credentials: "Неверное имя пользователя или пароль",
    placeholder_username: "например, admin",
    placeholder_email: "name@domain.com",
    
    // Dashboard
    logout: "Выйти",
    routes_tab: "Маршруты",
    chats_tab: "Пул чатов",
    active_routes: "Активные маршруты",
    total_routes: "Всего настроено путей",
    close: "Закрыть",
    create_route: "+ Создать маршрут",
    config_pipeline: "Настройка маршрута пересылки",
    pipeline_name: "Название маршрута",
    direction_flow: "Направление пересылки",
    source_chat: "Исходный чат",
    target_chat: "Целевой чат",
    choose_source: "-- Выберите исходный чат --",
    choose_target: "-- Выберите целевой чат --",
    delay_seconds: "Задержка пересылки (в секундах)",
    filter_keywords: "Ключевые слова для фильтрации (через запятую)",
    save_pipeline: "Сохранить маршрут",
    no_pipelines: "Нет настроенных маршрутов",
    no_pipelines_desc: "Настройте путь пересылки, чтобы связать группы VKontakte и каналы Telegram в реальном времени.",
    add_first_route: "+ Добавить первый маршрут",
    source: "Источник",
    destination: "Назначение",
    chat_deleted: "[Чат удален]",
    none: "нет",
    active: "Активен",
    paused: "На паузе",
    delete: "Удалить",
    chats_pool_desc: "Список каналов, групп и бесед, зарегистрированных для сопоставления.",
    no_vk_chats: "В пуле нет чатов VKontakte.",
    no_tg_chats: "В пуле нет чатов Telegram.",
    remove: "Удалить",
    connect_new_chat: "Подключение чата через бота",
    generate_code_btn: "Сгенерировать пин-код подключения",
    code_instruction: "Для подключения чата отправьте боту в ЛС или в группу/канал команду:",
    your_code: "Ваш пин-код подключения",
    code_expires: "Код действителен в течение 10 минут",
    select_platform_code: "Выберите платформу для генерации кода",
    placeholder_chat_name: "например, Мой Telegram-канал",
    placeholder_id: "например, @channelname",
    footer_panel: "Панель управления Chat Forwarder &bull; Сессия активна &bull; Соединение защищено"
  },
  en: {
    // Landing
    logo: "CF",
    title: "CHAT FORWARDER",
    signin: "Sign In",
    signup: "Join Free",
    smm_automation: "SMM Automation",
    hero_headline: "Forward messages without delay.",
    hero_sub: "Sync your communities and channels in real-time. Fast, stable, and highly configurable. Powered by Bun and Next.js.",
    vk_group: "VKontakte Group",
    tg_channel: "Telegram Channel",
    stream_active: "active_stream_status: ok",
    origin: "Origin",
    delay: "Delay",
    target: "Target",
    reliable_title: "100% Reliable",
    reliable_desc: "Messages, attachments, and high-resolution media are delivered instantly and without losses.",
    flow_title: "Two-way Flow",
    flow_desc: "Message routing in any direction. Complete control and flexible forwarding rules.",
    footer_text: "2026 Chat Forwarder. No trackers. No logs sold.",
    dashboard_preview: "Dashboard Preview",
    powered_by: "Powered by Taste Skill",
    
    // Auth
    sys_auth: "System Authentication",
    error_label: "ERROR",
    success_label: "SUCCESS",
    username: "Username",
    password: "Password",
    email: "Email Address",
    confirm_password: "Confirm Password",
    login_btn: "Authenticate",
    register_btn: "Create Account",
    first_time: "First time here?",
    already_registered: "Already registered?",
    signin_here: "Sign In Here",
    register_title: "Register Account",
    redirecting: "Redirecting…",
    pw_mismatch: "Passwords do not match",
    invalid_credentials: "Invalid username or password",
    placeholder_username: "e.g. admin",
    placeholder_email: "name@domain.com",
    
    // Dashboard
    logout: "Log Out",
    routes_tab: "Routes",
    chats_tab: "Chats Pool",
    active_routes: "Active Routes",
    total_routes: "Total configured pipelines",
    close: "Close",
    create_route: "+ Create Route",
    config_pipeline: "Configure Message Pipeline",
    pipeline_name: "Pipeline Name",
    direction_flow: "Direction Flow",
    source_chat: "Source Chat",
    target_chat: "Target Chat",
    choose_source: "-- Choose source chat --",
    choose_target: "-- Choose target chat --",
    delay_seconds: "Forwarding Delay (Seconds)",
    filter_keywords: "Filter Keywords (Comma separated)",
    save_pipeline: "Save Pipeline",
    no_pipelines: "No pipelines configured",
    no_pipelines_desc: "Configure a forwarding route to bridge VKontakte groups with Telegram channels in real-time.",
    add_first_route: "+ Add First Route",
    source: "Source",
    destination: "Target",
    chat_deleted: "[Chat deleted]",
    none: "none",
    active: "Active",
    paused: "Paused",
    delete: "Delete",
    chats_pool_desc: "List of channels, groups, and conversations registered for mapping.",
    no_vk_chats: "No VK chats in pool.",
    no_tg_chats: "No Telegram chats in pool.",
    remove: "Remove",
    connect_new_chat: "Connect Chat via Bot",
    generate_code_btn: "Generate Connection Pin-Code",
    code_instruction: "To connect a chat, send the following command to the bot in PM or chat:",
    your_code: "Your Connection Pin-Code",
    code_expires: "Code is valid for 10 minutes",
    select_platform_code: "Select platform to generate code",
    placeholder_chat_name: "e.g. My Telegram Channel",
    placeholder_id: "e.g. @channelname",
    footer_panel: "Chat Forwarder Panel &bull; Admin Active &bull; Connection secure"
  }
};

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState("ru");

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved && (saved === "ru" || saved === "en")) {
      setLocale(saved);
    }
  }, []);

  const changeLocale = (newLocale) => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  const t = (key) => {
    return translations[locale]?.[key] || translations["ru"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, t, changeLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
