import { GetTweetDTO } from '@/api/dtos/tweet.dto';
import { RapidTwitterService } from '@/crawler/services/rapid-twitter.service';
import {
  AdminConfigRepository,
  TweetRepository,
  TwitterUserRepository,
} from '@/database/repositories';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class TweetService implements OnApplicationBootstrap {
  constructor(
    @InjectPinoLogger(TweetService.name)
    private readonly logger: PinoLogger,
    private readonly rapidTwitterService: RapidTwitterService,
    private readonly tweetRepository: TweetRepository,
    private readonly adminConfigRepository: AdminConfigRepository,
    private readonly twitterUserRepository: TwitterUserRepository,
  ) {}
  onApplicationBootstrap() {
    // const fromTimestamp = new Date('2024-12-07 00:00:00Z').getTime();
    // this.getTweetsAndInfoByUsername(
    //   '_Shadow36',
    //   {
    //     max_recursive: 10,
    //   },
    //   fromTimestamp,
    // ).then(console.log);
  }

  async getTweetsAndInfoByUsername(
    username: string,
    query: GetTweetDTO,
    fromTimestamp?: number,
  ) {
    const FORCE = false;
    const DEBUG = false;

    const maxRecursive = query?.max_recursive || 1;
    DEBUG &&
      console.log(
        'Fetch tweets and info by username',
        username,
        'max recursive',
        maxRecursive,
        'is only db',
        query.only_db,
        'from timestamp',
        fromTimestamp,
      );
    let twitterUser = await this.twitterUserRepository.findOne({
      where: {
        username,
      },
    });
    if (!twitterUser) {
      const _twitterUser =
        await this.rapidTwitterService.fetchUserInfoByUsername(username);
      console.log(_twitterUser, '_twitterUser');

      twitterUser = await this.twitterUserRepository.save(
        this.rapidTwitterService.convertTwitterUserData({
          legacy: _twitterUser,
          rest_id: _twitterUser?.id_str,
        }),
      );
    }
    const resTweets = await this.tweetRepository.find({
      where: {
        twitter_user_id: twitterUser.id,
      },
      order: {
        post_created: 'DESC',
      },
    });
    DEBUG &&
      console.log(
        '======',
        twitterUser?.last_fetch_tweet?.getTime(),
        twitterUser?.last_fetch_tweet,
        Date.now(),
        new Date(),
      );
    let newTweets = [];
    if (
      FORCE ||
      !twitterUser?.last_fetch_tweet ||
      twitterUser?.last_fetch_tweet?.getTime() + 1000 * 60 * 15 < Date.now()
    ) {
      DEBUG && console.log('Fetch new tweets with max recursive', maxRecursive);
      try {
        const { numQuery, tweets: _resTweets } =
          await this.rapidTwitterService.fetchTweets(
            username,
            resTweets?.length ? 1 : maxRecursive,
            { minView: 0 },
            fromTimestamp,
          );
        newTweets = _resTweets;
        (async () => {
          await this.tweetRepository.upsert(
            newTweets.map((tweet) => ({
              ...tweet,
              twitter_user_id: twitterUser.id,
              trackable: false,
            })),
            { conflictPaths: ['tweet_id'] },
          );
          await this.twitterUserRepository.update(
            {
              id: twitterUser.id,
            },
            {
              num_query: twitterUser.num_query + numQuery,
              last_fetch_tweet: new Date(),
            },
          );
        })()
          .then(() => {
            DEBUG && console.log(`===== PERSISTED TWEETS of ${username} =====`);
          })
          .catch((error) => {
            console.error(error);
          });
        DEBUG && console.log(`===== FETCHED TWEETS of ${username} =====`);
      } catch (error) {
        throw error;
      }
    }
    const mergedTweets = [
      ...newTweets,
      ...resTweets?.filter(
        (tweet) =>
          !newTweets?.some((newTweet) => newTweet.tweet_id === tweet.tweet_id),
      ),
    ].sort((a, b) => {
      return (
        new Date(b.post_created).getTime() - new Date(a.post_created).getTime()
      );
    });
    return {
      info: {
        username: twitterUser?.username,
        follower_count: twitterUser?.follower_count,
        following_count: twitterUser?.following_count,
        name: twitterUser?.name,
        is_blue_verified: twitterUser?.is_blue_verified,
        description: twitterUser?.metadata?.description,
      },
      tweets: mergedTweets.map((tweet) => ({
        tweet_id: tweet.tweet_id,
        post_created: tweet.post_created,
        favorite_count: tweet.favorite_count,
        retweet_count: tweet.retweet_count,
        reply_count: tweet.reply_count,
        content: tweet.content,
        views: tweet.views,
        related: {
          retweet: {
            content: tweet.related?.retweet?.content,
            post_created: tweet.related?.retweet?.post_created,
            favorite_count: tweet.related?.retweet?.favorite_count,
          },
          quote: {
            content: tweet.related?.quote?.content,
            post_created: tweet.related?.quote?.post_created,
            favorite_count: tweet.related?.quote?.favorite_count,
          },
        },
      })),
    };
  }
}
