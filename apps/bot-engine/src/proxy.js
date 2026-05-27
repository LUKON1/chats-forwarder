import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

// Generate Socks/HTTP agent based on PROXY_URL configuration
export function getProxyAgent(targetDomain) {
  const proxyUrl = process.env.PROXY_URL;

  if (!proxyUrl) return undefined;

  if (proxyUrl.startsWith("socks")) {
    console.log(`Using SOCKS proxy for ${targetDomain || "any"}: ${proxyUrl}`);
    // Pass tls.servername to prevent 'unrecognized name' SSL alerts
    return new SocksProxyAgent(proxyUrl, {
      tls: targetDomain ? { servername: targetDomain } : undefined,
    });
  }
  if (proxyUrl.startsWith("http")) {
    console.log(`Using HTTP/HTTPS proxy: ${proxyUrl}`);
    return new HttpsProxyAgent(proxyUrl);
  }

  return undefined;
}
