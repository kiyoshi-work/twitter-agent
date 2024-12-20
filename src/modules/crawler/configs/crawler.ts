import { registerAs } from '@nestjs/config';

export const configCrawler = registerAs('crawler', () => ({
  rapid_api: {
    key:
      process.env.RAPID_KEY ||
      'cded57fe77msh96eb35449fb230fp17a709jsna5eedee97cdb',
    twitter_host:
      process.env.RAPID_TWITTER_API_HOST || 'twttrapi.p.rapidapi.com',
  },
  rapid_api_45: {
    key:
      process.env.RAPID_KEY_45 ||
      'cded57fe77msh96eb35449fb230fp17a709jsna5eedee97cdb',
    host:
      process.env.RAPID_TWITTER_API_HOST_45 || 'twitter-api45.p.rapidapi.com',
  },
  birdeye: {
    api_key:
      process.env.BIRDEYE_API_KEY || 'b5b7b6b6-4d5d-4b7d-9b5b-2b5b7b7b7b7b',
    base_url: process.env.BIRDEYE_BASE_URL || 'https://public-api.birdeye.so',
  },
  coingecko: {
    host: process.env.COINGECKO_HOST || 'https://pro-api.coingecko.com/api/v3',
    api_key: process.env.COINGECKO_API_KEY,
  },
}));
