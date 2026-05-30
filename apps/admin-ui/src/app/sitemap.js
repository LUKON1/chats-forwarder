import { headers } from 'next/headers'

export default function sitemap() {
  const host = headers().get('host');
  return [
  {
    url: `https://${host}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 1
  },
  {
    url: `https://${host}/how-to-start`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8
  },
  {
    url: `https://${host}/register`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.5
  }
  ]
}