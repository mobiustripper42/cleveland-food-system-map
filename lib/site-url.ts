// Production resolves to the primary domain; previews to their deploy URL.
const host =
  process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;

/** Absolute site origin, e.g. https://clevelandfoodsystem.land */
export const SITE_URL = host ? `https://${host}` : 'http://localhost:3000';
