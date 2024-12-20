import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import {
  AdminConfigRepository,
  TweetRepository,
  TwitterUserRepository,
  UserRepository,
} from '@/database/repositories';
import { RapidTwitterService } from '@/crawler/services/rapid-twitter.service';
const schedulerTime: number = process.env.APP_ENV === 'production' ? 10 : 30;

@Injectable()
export class CrawlTwitterScheduleService {
  private minView: number = 10000;
  private minFollower: number = 10000;
  private fetchTweetPerHour: number = 10000;
  private fetchTweetBatchSize: number = 8;
  constructor(
    private readonly rapidTwitterService: RapidTwitterService,
    private readonly tweetRepository: TweetRepository,
    private readonly twitterUserRepository: TwitterUserRepository,
    private readonly adminConfigRepository: AdminConfigRepository,
  ) {}

  async onModuleInit() {
    await this._loadCrawlConfig();
  }
  async _loadCrawlConfig() {
    const adminConfig =
      await this.adminConfigRepository.findTwitterCrawlerConfig();
    this.minView = Number(adminConfig?.data?.min_view || 10000);
    this.minFollower = Number(adminConfig?.data?.min_follower || 10000);
    this.fetchTweetBatchSize = Number(
      adminConfig?.data?.fetch_tweet_batch_size || 8,
    );
    this.fetchTweetPerHour = Number(
      adminConfig?.data?.fetch_tweet_per_hour || 10000,
    );
  }
  @Cron(CronExpression.EVERY_MINUTE)
  async loadCrawlConfig() {
    await this._loadCrawlConfig();
  }

  @Timeout(1000)
  async test() {
    console.log('Test [SCHEDULER] 1');
  }

  @Cron(`*/${schedulerTime} * * * *`)
  // @Timeout(2000)
  async cronFetchSpecificUserTweets() {
    const adminConfig =
      await this.adminConfigRepository.findSpecificTwitterUser();
    console.log(adminConfig?.data?.users, 'adminConfig?.data?.users');
    for (const user of adminConfig?.data?.users || []) {
      await this.rapidTwitterService.fetchTweetsByUser(user, 0, 1);
      console.log('===== FETCHED =====:', user);
    }
  }

  async getUserTweetsBatch(
    data: { twitterUserId: string; username: string }[],
  ) {
    try {
      const tweetData: Record<string, any> = {};
      await Promise.all(
        data.map(async ({ username, twitterUserId }) => {
          try {
            const _tmp = await this.rapidTwitterService.fetchTweets(
              username,
              1,
              {
                minView: this.minView,
              },
            );
            tweetData[twitterUserId] = _tmp;
          } catch (error) {
            console.log('🚀 ~ ScheduleService: data.map ~ error:', error);
            await this.twitterUserRepository.query(`
            UPDATE "twitter_users"
            SET num_fail_query = num_fail_query + 1
            WHERE id = '${twitterUserId}'`);
          }
        }),
      );
      if (tweetData && Object.keys(tweetData).length) {
        await this.tweetRepository.upsert(
          Object.entries(tweetData)
            .map((tweet) =>
              tweet[1]?.tweets?.map((_tw) => ({
                ..._tw,
                twitter_user_id: tweet[0],
              })),
            )
            .flat(),
          { conflictPaths: ['tweet_id'] },
        );
        const updateQuery = Object.entries(tweetData)
          .map(
            (tweet) =>
              `UPDATE "twitter_users"
          SET num_query = num_query + ${tweet[1]?.numQuery || 0},  last_fetch_tweet = NOW()
          WHERE id = '${tweet[0]}'
          `,
          )
          .join('; ');
        await this.twitterUserRepository.query(updateQuery);
      }
    } catch (error) {
      console.log('🚀 ~ ScheduleService ~ getUserTweetsBatch:', error);
    }
  }

  async getUserTweets(twitterUserId: string, username: string) {
    try {
      const { tweets, numQuery } = await this.rapidTwitterService.fetchTweets(
        username,
        1,
        { minView: this.minView },
      );
      if (tweets && tweets.length) {
        await this.tweetRepository.upsert(
          tweets.map((tweet) => ({
            ...tweet,
            twitter_user_id: twitterUserId,
          })),
          { conflictPaths: ['tweet_id'] },
        );
      }
      await this.twitterUserRepository.query(`
      UPDATE "twitter_users"
      SET num_query = num_query + ${numQuery || 0},  last_fetch_tweet = NOW()
      WHERE id = '${twitterUserId}'`);
    } catch (error) {
      await this.twitterUserRepository.query(`
      UPDATE "twitter_users"
      SET num_fail_query = num_fail_query + 1
      WHERE id = '${twitterUserId}'`);
    }
  }
}
