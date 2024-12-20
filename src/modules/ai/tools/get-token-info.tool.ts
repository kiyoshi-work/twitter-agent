import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import * as z from 'zod';
import { BaseTool } from './base.tool';
import axios from 'axios';
import { TokenInfoRepository } from '@/database/repositories';
import { TokenInfoEntity } from '@/database/entities';
import { RapidTwitterService } from '@/crawler/services/rapid-twitter.service';
import { TwitterUserProfile } from '@/crawler/interfaces/twitter-user.interface';
import { RedisCacheService } from '@/redis-cache/redis-cache.service';
import {
  BirdEyeService,
  TokenOverviewResponse,
} from '@/crawler/services/birdeye.service';

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: Pair[];
}

interface Pair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: Token;
  quoteToken: Token;
  priceNative: string;
  priceUsd?: string;
  txns: Transactions;
  volume: Volume;
  priceChange: PriceChange;
  liquidity: Liquidity;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt: number;
  info?: Info;
  holder_count?: number;
  twitter_description?: string;
}

interface Token {
  address: string;
  name: string;
  symbol: string;
}

interface Transactions {
  m5: TransactionDetails;
  h1: TransactionDetails;
  h6: TransactionDetails;
  h24: TransactionDetails;
}

interface TransactionDetails {
  buys: number;
  sells: number;
}

interface Volume {
  h24: number;
  h6: number;
  h1: number;
  m5: number;
}

interface PriceChange {
  m5: number;
  h1: number;
  h6: number;
  h24: number;
}

interface Liquidity {
  usd: number;
  base: number;
  quote: number;
}

interface Info {
  imageUrl?: string;
  header?: string;
  openGraph?: string;
  websites?: Website[];
  socials?: Social[];
}

interface Website {
  label: string;
  url: string;
}

interface Social {
  type: string;
  url: string;
}

@Injectable()
export class GetTokenInfoTool
  extends BaseTool
  implements OnApplicationBootstrap
{
  @Inject(RapidTwitterService)
  private readonly rapidTwitterService: RapidTwitterService;

  constructor(
    @Inject(TokenInfoRepository)
    private tokenInfoRepository: TokenInfoRepository,
    private readonly redisCacheService: RedisCacheService,
    private readonly birdEyeService: BirdEyeService,
  ) {
    super();
  }

  async onApplicationBootstrap() {}
  // NOTE: defined type of config here
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'get_token_info';
  description = `Get token info onchain include: marketcap, price, holders, supply, volume, etc.`;

  nameToken = '';

  schema = z.object({
    symbol: z.string().describe('This is token symbol'),
  }) as any;

  async _call(input: any) {
    console.log(input, 'input');
    try {
      if (!input?.symbol) {
        console.log('not found data symbol');
        return JSON.stringify({ error: 'not found data symbol', status: 400 });
      }
      const symbol = input?.symbol?.replace('$', '');
      // Try to get cached data first
      const cachedData = await this.tokenInfoRepository.findOne({
        where: { symbol: symbol },
      });

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // If we have fresh cached data, return it
      if (cachedData && cachedData.last_updated_at > oneHourAgo) {
        return await this.entityToResponse(cachedData);
      }

      // Otherwise, fetch new data
      const data = await this.getTokenInfoDexScreener(symbol);
      const topOne = data?.pairs?.[0];

      if (!topOne) {
        return '---------fetch dexscreener --------- not found data for symbol';
      }

      const twitter = topOne.info?.socials?.find((i) => i.type === 'twitter');
      const twitterUsername = twitter?.url.split('/').pop();

      let holders = { data: { items: [] } };
      let tweets = [];
      const error: any = {};
      let tokenOverview: TokenOverviewResponse | null = null;
      let twitterUser: TwitterUserProfile | null = null;

      const address = topOne.baseToken.address;

      await Promise.all([
        (async () => {
          try {
            holders = await this.birdEyeService.getTokenHoldersBirdeye(
              address,
              topOne.chainId,
            );
          } catch (error) {
            error['birdeye'] = error;
          }
        })(),
        (async () => {
          try {
            const rs =
              await this.rapidTwitterService.searchTweetMentionCA(symbol);
            tweets = rs.tweets.map((i) => ({
              content: i.content,
              created_at: i.post_created,
              cc: i.name,
            }));
          } catch (error) {
            error['twitter'] = error;
          }
        })(),
        (async () => {
          try {
            const rs = await this.birdEyeService.getTokenOverview(
              address,
              topOne.chainId,
            );
            tokenOverview = rs;
          } catch (error) {
            error['search_tweet'] = error;
          }
        })(),
        (async () => {
          try {
            const rs =
              await this.rapidTwitterService.fetchUserInfoByUsername(
                twitterUsername,
              );
            twitterUser = rs;
          } catch (error) {
            error['fetch_bio'] = error;
          }
        })(),
      ]);

      // console.log({
      //   error,
      //   tokenOverview,
      //   twitterUser,
      // });

      const totalSupply = topOne.marketCap / Number(topOne.priceUsd);
      const processedHolders = holders.data.items.map((item) => ({
        amount: item.ui_amount,
        owner: item.owner,
        percentage: (Number(item.ui_amount) / totalSupply) * 100,
      }));

      // Convert and save to database
      const tokenInfoEntity = this.pairToEntity(
        topOne,
        processedHolders,
        tweets,
        tokenOverview?.data,
        twitterUser,
      );
      await this.tokenInfoRepository.upsert(
        {
          ...tokenInfoEntity,
          error_message_birdeye: error as any,
        },
        {
          conflictPaths: ['symbol'],
        },
      );
      return await this.entityToResponse(tokenInfoEntity);
    } catch (error) {
      await this.tokenInfoRepository.upsert(
        {
          symbol: input.symbol,
          error_message_dexscreener: error?.message,
        },
        {
          conflictPaths: ['symbol'],
        },
      );
      return JSON.stringify({ status: 400, error: 'error' });
    }
  }

  private async getTokenInfoDexScreener(
    symbol: string,
  ): Promise<DexScreenerResponse> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/search?q=${symbol}`,
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw error;
    }
  }

  private pairToEntity(
    pair: Pair,
    holders: any[],
    tweets: any[],
    tokenOverview: any,
    twitterUser: TwitterUserProfile | null,
  ): TokenInfoEntity {
    const entity = new TokenInfoEntity();

    // Basic fields
    entity.symbol = pair.baseToken.symbol;
    entity.name = pair.baseToken.name;

    // Pair fields
    entity.chain_id = pair.chainId;
    entity.dex_id = pair.dexId;
    entity.url = pair.url;
    entity.pair_address = pair.pairAddress;
    entity.labels = pair.labels || [];

    // Base token
    entity.base_address = pair.baseToken.address;
    entity.base_name = pair.baseToken.name;
    entity.base_symbol = pair.baseToken.symbol;

    // Quote token
    entity.quote_address = pair.quoteToken.address;
    entity.quote_name = pair.quoteToken.name;
    entity.quote_symbol = pair.quoteToken.symbol;

    // Price info
    entity.price_native = pair.priceNative;
    entity.price_usd = pair.priceUsd;
    entity.fdv = pair.fdv;
    entity.market_cap = pair.marketCap;
    entity.pair_created_at = pair.pairCreatedAt;

    // Transactions
    entity.txn_m5_buys = pair.txns.m5.buys;
    entity.txn_m5_sells = pair.txns.m5.sells;
    entity.txn_h1_buys = pair.txns.h1.buys;
    entity.txn_h1_sells = pair.txns.h1.sells;
    entity.txn_h6_buys = pair.txns.h6.buys;
    entity.txn_h6_sells = pair.txns.h6.sells;
    entity.txn_h24_buys = pair.txns.h24.buys;
    entity.txn_h24_sells = pair.txns.h24.sells;

    // Price changes
    entity.price_change_m5 = pair.priceChange.m5;
    entity.price_change_h1 = pair.priceChange.h1;
    entity.price_change_h6 = pair.priceChange.h6;
    entity.price_change_h24 = pair.priceChange.h24;

    // Liquidity
    // entity.liquidity_usd = pair.liquidity.usd;
    // NOTE: chang this
    entity.liquidity_usd = tokenOverview?.liquidity;
    entity.liquidity_base = pair.liquidity.base;
    entity.liquidity_quote = pair.liquidity.quote;

    // entity.volume_h24 = pair.volume.h24;
    // NOTE: chang this
    entity.volume_h24 = tokenOverview?.v24hUSD;
    entity.volume_h1 = pair.volume.h1;
    entity.volume_h6 = pair.volume.h6;
    entity.volume_m5 = pair.volume.m5;

    // Info
    if (pair.info) {
      entity.info_image_url = pair.info.imageUrl;
      entity.info_header = pair.info.header;
      entity.info_open_graph = pair.info.openGraph;
      entity.info_websites = pair.info.websites;
      entity.info_socials = pair.info.socials;
    }

    // Holders
    entity.holder_count = tokenOverview?.overview;
    entity.holders = holders;

    entity.twitter_description = twitterUser?.description;

    // Tweets
    entity.recent_tweets = tweets;

    // Last updated
    entity.last_updated_at = new Date();

    return entity;
  }

  async getLargeCapPrice() {}

  private async entityToResponse(entity: TokenInfoEntity): Promise<any> {
    // NOTE: change this
    const topToken = await this.redisCacheService.getTopTokenInfo(
      entity?.symbol?.toLowerCase(),
    );
    const pair: Partial<Pair> = topToken
      ? {
          priceUsd: `$${topToken?.current_price || entity.price_usd}`,
          priceChange: {
            h24: `$${topToken?.price_change_24h || entity.price_change_h24}`,
          } as any,
          liquidity: {
            usd: `$${topToken ? null : entity.liquidity_usd}`,
          } as any,
          volume: {
            h24: `$${topToken?.total_volume || entity.volume_h24}`,
          } as any,
          marketCap: topToken?.market_cap || entity.market_cap,
        }
      : {
          // chainId: entity.chain_id,
          // dexId: entity.dex_id,
          // url: entity.url,
          // pairAddress: entity.pair_address,
          // labels: entity.labels,
          // baseToken: {
          //   address: entity.base_address,
          //   name: entity.base_name,
          //   symbol: entity.base_symbol,
          // },
          // quoteToken: {
          //   address: entity.quote_address,
          //   name: entity.quote_name,
          //   symbol: entity.quote_symbol,
          // },
          // priceNative: entity.price_native,
          // NOTE: change this
          priceUsd: `$${entity.price_usd}`,
          // txns: {
          //   m5: { buys: entity.txn_m5_buys, sells: entity.txn_m5_sells },
          //   h1: { buys: entity.txn_h1_buys, sells: entity.txn_h1_sells },
          //   h6: { buys: entity.txn_h6_buys, sells: entity.txn_h6_sells },
          //   h24: { buys: entity.txn_h24_buys, sells: entity.txn_h24_sells },
          // },
          priceChange: {
            // m5: entity.price_change_m5,
            // h1: entity.price_change_h1,
            // h6: `$${entity.price_change_h6}`,
            h24: `$${entity.price_change_h24}`,
          } as any,
          liquidity: {
            usd: `$${entity.liquidity_usd}`,
            // base: entity.liquidity_base,
            // quote: entity.liquidity_quote,
          } as any,
          volume: {
            // h1: `$${entity.volume_h1}`,
            // h6: `$${entity.volume_h6}`,
            h24: `$${entity.volume_h24}`,
          } as any,
          // fdv: entity.fdv,
          marketCap: entity.market_cap,
          // pairCreatedAt: entity.pair_created_at,
          // info: {
          //   imageUrl: entity.info_image_url,
          //   header: entity.info_header,
          //   openGraph: entity.info_open_graph,
          //   websites: entity.info_websites,
          //   socials: entity.info_socials,
          // },
          holder_count: entity.holder_count,
          twitter_description: entity.twitter_description,
        };

    return JSON.stringify({
      data: {
        info: pair,
        holders: entity.holders,
        // recent_tweets: entity.recent_tweets,
      },
      status: 200,
    });
  }
}
