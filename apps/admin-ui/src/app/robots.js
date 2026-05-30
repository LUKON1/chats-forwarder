import { headers } from 'next/headers';

export default function robots() {
  const host = `https://${headers().get('host')}`;

  return {
    rules: {
      userAgent: '*',
      disallow: [
        '/dashboard/', // Block admin panel search indexing
        '/api/',       // Block API routes if they exist under app/api
      ],
    },
    sitemap: `${host}/sitemap.xml`,
  }
}
