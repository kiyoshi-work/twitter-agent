import { Cron, CronExpression, Interval, Timeout } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import {
  ShilledTokenRepository,
  TweetRepository,
} from '@/database/repositories';
import { AiService } from '@/ai/services/ai.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisCacheService } from '@/redis-cache/redis-cache.service';
import { CoingeckoService } from '@/crawler/services/coingecko.service';
import { fetchTwitterNewsTitles } from '@/shared/api';
import { DocumentRepository } from '@/pgvector-db/repositories/document.repository';
import { EPostSource } from '@/pgvector-db/entities/document.entity';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectPinoLogger(ScheduleService.name)
    private readonly logger: PinoLogger,
    private readonly tweetRepository: TweetRepository,
    private readonly shilledTokenRepository: ShilledTokenRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly aiService: AiService,
    private readonly redisCacheService: RedisCacheService,
    private readonly coingeckoService: CoingeckoService,
  ) {}

  async onModuleInit() {}

  @Interval(2 * 60 * 60 * 1000)
  // @Timeout(10000)
  async embbedNewTweets() {
    const data = await fetchTwitterNewsTitles(100, true);
    const notExistDb = [];
    for (const dt of data) {
      if (
        !(await this.documentRepository.exists({
          where: { post_id: dt.rest_id },
        }))
      ) {
        notExistDb.push(dt);
      }
    }
    this.logger.info(`=== PREPARE NEW ${notExistDb.length} tweets ====`);
    await this.documentRepository.addDocuments(
      notExistDb.map((dt) => ({
        pageContent: `${dt.title}${dt?.tags?.length ? ` with tags ${dt?.tags?.join(',')}` : ''}`,
        post_id: dt.rest_id,
        post_source: EPostSource.Twitter,
        post_created: dt?.post_created,
        metadata: {
          quote_count: dt?.quote_count,
          reply_count: dt?.reply_count,
          retweet_count: dt?.retweet_count,
          favorite_count: dt?.favorite_count,
        },
        tags: dt?.tags?.join(','),
      })),
    );
    this.logger.info(`=== EMBEDDED NEW ${notExistDb.length} tweets ====`);
  }

  @Interval(1 * 60 * 1000)
  // @Timeout(1000)
  async updateTop100Price() {
    try {
      const response = await this.coingeckoService.fetchTop100Coin();
      await Promise.all(
        response?.map((r: any) => {
          this.redisCacheService.setTopTokenInfo(
            r.symbol?.toLowerCase(),
            {
              current_price: r?.current_price,
              market_cap: r?.market_cap,
              price_change_24h: r?.price_change_24h,
              price_change_percentage_24h: r?.price_change_percentage_24h,
              total_volume: r?.total_volume,
            },
            60 * 60 * 24 * 30,
          );
        }),
      );
      this.logger.info(`Persist top 100 tokens in redis`);
      // const t = await this.redisCacheService.getTopTokenInfo('btc');
      // console.log(t?.current_price, 'tttt');
    } catch (error) {
      console.log(error?.message, 'error');
    }
  }

  // @Interval(30000)
  async extractSymbolFromTweet() {
    const tweets = await this.tweetRepository.find({
      where: {
        is_tracked: false,
        trackable: true,
      },
      relations: ['twitter_user'],
      order: { post_created: 'ASC' },
      take: 10,
    });
    this.logger.info(`Start extracting ${tweets.map((tw) => tw.id)}`);
    await Promise.all(
      tweets.map(async (tweet) => {
        const shillTokens = await this.aiService.extractSymbolFromTweet(tweet);
        if (shillTokens?.length) {
          await this.shilledTokenRepository.upsert(
            shillTokens?.map((shillToken) => ({
              symbol: shillToken?.token,
              post_created: tweet.post_created,
              tweet_id: tweet.id,
              username: tweet?.twitter_user?.username,
              related_score: shillToken?.related_score,
              positive_score: shillToken?.positive_score,
              insights: shillToken?.insights,
              reason: shillToken?.reason,
              favorite_count: tweet.favorite_count,
              reply_count: tweet.reply_count,
              retweet_count: tweet.retweet_count,
            })),
            { conflictPaths: ['symbol', 'post_created'] },
          );
        }
        await this.tweetRepository.update(
          {
            id: tweet.id,
          },
          {
            is_tracked: true,
          },
        );
        this.logger.info(
          `Extracted ${JSON.stringify(shillTokens)}} from tweet ${tweet.id}`,
        );
      }),
    );
  }
}
