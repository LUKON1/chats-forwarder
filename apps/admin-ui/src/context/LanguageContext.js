"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

const LanguageContext = createContext();

const translations = {
  ru: {
    // Landing
    logo: "CF",
    title: "Chat Forwarder",
    signin: "Войти",
    signup: "Регистрация",
    smm_automation: "Автоматизация SMM",
    hero_headline: "Пересылка сообщений без задержек.",
    hero_sub: "Синхронизируйте чаты и каналы в реальном времени. Быстро, стабильно и с гибкой настройкой.",
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
    dashboard_preview_desc: "* Попробуйте нажимать кнопки, чтобы протестировать механику интерфейса",
    
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
    server_connection_failed: "Ошибка соединения с сервером",
    registration_failed: "Ошибка регистрации пользователя",
    
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
    code_instruction: "Для подключения чата отправьте боту в группу/канал команду:",
    your_code: "Ваш пин-код подключения",
    code_expires: "Код действителен в течение 10 минут",
    select_platform_code: "Выберите платформу для генерации кода",
    footer_panel: "Панель управления Chat Forwarder • Сессия активна • Соединение защищено",

    // Added/Missing translations
    author_shown: "С отправителем",
    author_hidden: "Без отправителя",
    loading_auth_state: "ПРОВЕРКА АВТОРИЗАЦИИ...",
    cannot_connect_api: "Не удалось подключиться к серверу API бота на порту 4000",
    sync_with_api: "СИНХРОНИЗАЦИЯ С СЕРВЕРОМ API...",
    placeholder_pipeline_name: "например, VK -> Telegram",
    direction_vk_to_tg: "VKontakte ──► Telegram",
    direction_tg_to_vk: "Telegram ──► VKontakte",
    generating: "ГЕНЕРАЦИЯ...",
    username_too_short: "Имя пользователя должно быть от 3 до 20 символов",
    password_too_short: "Пароль должен быть не менее 6 символов",
    "Missing required fields": "Заполните все обязательные поля",
    "Cannot bridge a chat to itself": "Нельзя настроить пересылку из чата в него же",
    "Username already taken": "Это имя пользователя уже занято",
    "Username must be between 3 and 20 characters long": "Имя пользователя должно быть длиной от 3 до 20 символов",
    "Password must be at least 6 characters long": "Пароль должен быть не менее 6 символов",
    "Failed to generate code": "Не удалось сгенерировать код подключения",
    "Failed to disconnect chat": "Не удалось удалить чат из пула",
    "Failed to create pipeline": "Не удалось создать маршрут пересылки",
    "API server connection failed": "Ошибка соединения с сервером API",

    // How to Start translations
    how_to_start: "Как начать",
    docs_back_to_landing: "На главную",
    docs_intro_title: "Быстрый старт",
    docs_intro_sub: "Четыре шага для запуска автоматической пересылки.",
    docs_bots_title: "Наши боты",
    docs_bots_sub: "Добавьте нужного бота в свой чат или канал как администратора.",
    docs_step1_title: "Регистрация",
    docs_step1_badge: "Шаг 01",
    docs_step1_desc: "Создайте аккаунт на странице регистрации. Придумайте имя пользователя и надежный пароль — это единственные данные, которые мы храним.",
    docs_step2_title: "Добавьте бота как администратора",
    docs_step2_badge: "Шаг 02",
    docs_step2_desc: "Добавьте нашего бота в целевую группу или канал и назначьте ему права администратора с возможностью публикации сообщений.",
    docs_step3_title: "Сгенерируйте пин-код и отправьте /connect",
    docs_step3_badge: "Шаг 03",
    docs_step3_desc: "В панели управления откройте вкладку 'Пул чатов' и сгенерируйте пин-код. Отправьте боту в чат команду /connect <код> — бот подтвердит подключение.",
    docs_step4_title: "Настройте маршрут",
    docs_step4_badge: "Шаг 04",
    docs_step4_desc: "Перейдите во вкладку 'Маршруты', нажмите '+ Создать маршрут', выберите источник и назначение. Пересылка запустится мгновенно.",
    docs_connect_cmd: "/connect <ваш_пин_код>",
    docs_bots_admin_note: "Требуются права администратора",
  },
  en: {
    // Landing
    logo: "CF",
    title: "Chat Forwarder",
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
    dashboard_preview_desc: "* Try clicking buttons to test the interface mechanics.",
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
    server_connection_failed: "Server connection failed",
    registration_failed: "User registration failed",
    
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
    code_instruction: "To connect a chat, send the following command to the bot in the group or channel:",
    your_code: "Your Connection Pin-Code",
    code_expires: "Code is valid for 10 minutes",
    select_platform_code: "Select platform to generate code",
    footer_panel: "Chat Forwarder Panel • Admin Active • Connection secure",

    // Added/Missing translations
    author_shown: "With sender",
    author_hidden: "No sender",
    loading_auth_state: "LOADING AUTHENTICATION STATE...",
    cannot_connect_api: "Could not connect to Bot API Server on port 4000",
    sync_with_api: "SYNCHRONIZING WITH BOT ENGINE API...",
    placeholder_pipeline_name: "e.g. VK -> Telegram",
    direction_vk_to_tg: "VKontakte ──► Telegram",
    direction_tg_to_vk: "Telegram ──► VKontakte",
    generating: "GENERATING...",
    username_too_short: "Username must be between 3 and 20 characters",
    password_too_short: "Password must be at least 6 characters",
    "Missing required fields": "Missing required fields",
    "Cannot bridge a chat to itself": "Cannot bridge a chat to itself",
    "Username already taken": "Username already taken",
    "Username must be between 3 and 20 characters long": "Username must be between 3 and 20 characters",
    "Password must be at least 6 characters long": "Password must be at least 6 characters",
    "Failed to generate code": "Failed to generate code",
    "Failed to disconnect chat": "Failed to disconnect chat",
    "Failed to create pipeline": "Failed to create pipeline",
    "API server connection failed": "API server connection failed",

    // How to Start translations
    how_to_start: "How to Start",
    docs_back_to_landing: "Back to Home",
    docs_intro_title: "Quick Start",
    docs_intro_sub: "Four steps to launch automated message forwarding.",
    docs_bots_title: "Our Bots",
    docs_bots_sub: "Add the right bot to your chat or channel as an administrator.",
    docs_step1_title: "Register",
    docs_step1_badge: "Step 01",
    docs_step1_desc: "Create an account on the registration page. Pick a username and a strong password - those are the only details we store.",
    docs_step2_title: "Add the bot as admin",
    docs_step2_badge: "Step 02",
    docs_step2_desc: "Add our bot to the target group or channel and grant it administrator rights with the ability to post messages.",
    docs_step3_title: "Generate a pin-code and send /connect",
    docs_step3_badge: "Step 03",
    docs_step3_desc: "In the dashboard open the 'Chats Pool' tab and generate a pin-code. Send the bot the command /connect <code> inside the chat - it will confirm the connection instantly.",
    docs_step4_title: "Configure a route",
    docs_step4_badge: "Step 04",
    docs_step4_desc: "Go to the 'Routes' tab, click '+ Create Route', pick a source and a destination. Forwarding starts immediately.",
    docs_connect_cmd: "/connect <your_pin_code>",
    docs_bots_admin_note: "Administrator rights required",
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

  const changeLocale = useCallback((newLocale) => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const t = useCallback((key) => {
    return translations[locale]?.[key] || translations["ru"]?.[key] || key;
  }, [locale]);

  const value = useMemo(() => ({ locale, t, changeLocale }), [locale, t, changeLocale]);

  return (
    <LanguageContext.Provider value={value}>
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
