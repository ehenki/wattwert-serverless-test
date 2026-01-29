const isServer = typeof window === 'undefined';

const config = {
  apiUrl: isServer 
    ? (process.env.INTERNAL_API_URL ?? 'http://localhost:8003') // only fall back to localhost if no API URL is set at all - an empty one (like provided in .env.production)is still accepted
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003')
};

export default config;