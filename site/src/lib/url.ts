// All internal links and data fetches go through here so the site works under a GitHub Pages base path.
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export const href = (path = ''): string => BASE + path.replace(/^\//, '');
export const dataUrl = (path: string): string => href(`data/${path.replace(/^\//, '')}`);
export const plantHref = (slug: string): string => href(`plants/${slug}/`);
