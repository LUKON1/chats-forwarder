import { headers } from 'next/headers';

export default async function robots() {
  const reqHeaders = await headers();
  const host = `https://${reqHeaders.get('host')}`;

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
