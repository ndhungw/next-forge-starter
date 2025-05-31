import fs from 'node:fs';
import { env } from '@/env';
import type { MetadataRoute } from 'next';

// Dummy blog and legal modules for sitemap generation
const blog = {
  getPosts: () => {
    // This would normally fetch from a CMS or database
    return [
      { _slug: 'getting-started' },
      { _slug: 'best-practices' },
      { _slug: 'advanced-techniques' },
    ];
  },
};

const legal = {
  getPosts: () => {
    // This would normally fetch from a CMS or database
    return [
      { _slug: 'terms-of-service' },
      { _slug: 'privacy-policy' },
      { _slug: 'cookie-policy' },
    ];
  },
};

const appFolders = fs.readdirSync('app', { withFileTypes: true });
const pages = appFolders
  .filter((file) => file.isDirectory())
  .filter((folder) => !folder.name.startsWith('_'))
  .filter((folder) => !folder.name.startsWith('('))
  .map((folder) => folder.name);
const blogs = (await blog.getPosts()).map((post) => post._slug);
const legals = (await legal.getPosts()).map((post) => post._slug);
const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith('https')
  ? 'https'
  : 'http';
const url = new URL(`${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL}`);

const sitemap = async (): Promise<MetadataRoute.Sitemap> => [
  {
    url: new URL('/', url).href,
    lastModified: new Date(),
  },
  ...pages.map((page) => ({
    url: new URL(page, url).href,
    lastModified: new Date(),
  })),
  ...blogs.map((blog) => ({
    url: new URL(`blog/${blog}`, url).href,
    lastModified: new Date(),
  })),
  ...legals.map((legal) => ({
    url: new URL(`legal/${legal}`, url).href,
    lastModified: new Date(),
  })),
];

export default sitemap;
