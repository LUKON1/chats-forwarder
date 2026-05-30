import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import Header from "@/components/Header";
import logoImg from "@/assets/logo.svg"
import { headers } from 'next/headers';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
 
// Dynamic metadata generation to fetch the current host safely
export async function generateMetadata() {
  const reqHeaders = headers();
  const hostHeader = reqHeaders.get('host') || 'localhost:3000';
  const host = new URL(`https://${hostHeader}`);

  return {
    metadataBase: host,

    title: {
      default: "Chats Forwarder",
      template: "%s | Chats Forwarder",
    },
    description: "Кроссплатформенная пересылка сообщений между мессенджерами.",
    keywords: [
      "forwarder", "telegram", "vk", "crossposting", "autoposting", 
      "vk bot", "telegram bot", "chats", "chat", "messages", "message", 
      "cross platform", "cross platform messaging", "cross platform communication"
    ],

    // Open Graph settings for link previews in VK, Telegram, etc.
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: host.toString(),
      title: "Chats Forwarder",
      description: "Кроссплатформенная пересылка сообщений между мессенджерами.",
      images: [{ url: logoImg.src }],
    },

    // Twitter Card metadata
    twitter: {
      card: "summary_large_image",
      title: "Chats Forwarder",
      description: "Кроссплатформенная пересылка сообщений между мессенджерами.",
      images: [logoImg.src],
    }
  };
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-yale-blue-950 text-lime-cream-50">
        <LanguageProvider>
          <Header />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
