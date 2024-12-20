import {
  AdminConfigRepository,
  TweetRepository,
  TwitterUserRepository,
} from '@/database/repositories';
import { TTwitterUserInfo } from '@/shared/types';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import {
  TwitterSearchResponse,
  TwitterEntry,
  TwitterSearchParams,
} from '../interfaces/twitter-search.interface';
import { TwitterUserProfile } from '../interfaces/twitter-user.interface';

export type TRelated = {
  quote?: TRelatedContent;
  retweet?: TRelatedContent;
};
export type TRelatedContent = {
  id: string;
  content: string;
  post_created?: Date;
  favorite_count?: number;
  author?: {
    username?: string;
    name?: string;
    bio?: string;
    location?: string;
    followers_count?: number;
    // rest_id?: string;
    // is_blue_verified?: boolean;
  };
  related?: TRelated;
};

interface SearchTweetMentionCAResponse {
  tweets: {
    tweet_id: string;
    post_created?: Date;
    content: string;
    favorite_count: number;
    reply_count: number;
    retweet_count: number;
    conversation_id: string;
    reply_to_id: string;
    views: number;
    media?: {
      media_url_https: string;
      original_info: any;
      type: string;
    }[];
    related?: TRelated;
    name: string;
  }[];
  numQuery: number;
}

@Injectable()
export class RapidTwitterService implements OnApplicationBootstrap {
  private _rapidKey?: string;
  private _rapidHost?: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly adminConfigRepository: AdminConfigRepository,
    private readonly twitterUserRepository: TwitterUserRepository,
    private readonly tweetRepository: TweetRepository,
  ) {
    this._rapidKey = this.configService.get<string>('crawler.rapid_api.key');
    this._rapidHost = `https://${this.configService.get<string>(
      'crawler.rapid_api.twitter_host',
    )}`;
  }
  async onApplicationBootstrap() {}

  _buildHeader() {
    return {
      'X-RapidAPI-Key': this._rapidKey,
      'X-RapidAPI-Host': this.configService.get<string>(
        'crawler.rapid_api.twitter_host',
      ),
    };
  }

  async sendRequest(options: AxiosRequestConfig) {
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getTweetsAnchor(username: string, cursor?: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/user-tweets`,
      params: {
        username: username,
        cursor: cursor,
      },
      headers: this._buildHeader(),
    };
    const data = await this.sendRequest(options as any);
    if (
      data?.data?.user_result?.result?.timeline_response?.timeline?.instructions
    ) {
      for (const _ins of data?.data?.user_result?.result?.timeline_response
        ?.timeline?.instructions) {
        if (_ins?.__typename === 'TimelineAddEntries') return _ins?.entries;
      }
    }
    return [];
  }
  parseQuoteOrRetweet(data: any, recursive: boolean = false): TRelatedContent {
    const legacyData = data?.result?.legacy;
    const legacyAuthor = data?.result?.core?.user_result?.result?.legacy;
    const quote = data?.result?.quoted_status_result;
    const retweet = data?.result?.legacy?.retweeted_status_result;
    if (legacyData) {
      const twt = {
        id: legacyData?.user_id_str,
        content: legacyData?.full_text,
        post_created: new Date(legacyData?.created_at),
        favorite_count: legacyData.favorite_count,
        related: undefined,
      };
      if (legacyAuthor) {
        twt['author'] = {
          username: legacyAuthor?.screen_name,
          name: legacyAuthor?.name,
          bio: legacyAuthor?.description,
          location: legacyAuthor?.location,
          followers_count: legacyAuthor?.followers_count,
          // rest_id: legacyAuthor?.id_str,
          // is_blue_verified:
          //   data?.result?.core?.user_result?.result?.is_blue_verified,
        };
      }
      if (quote && recursive) {
        twt['related'] = {
          ...twt?.related,
          quote: this.parseQuoteOrRetweet(quote),
        };
      }
      if (retweet && recursive) {
        twt['related'] = {
          ...twt?.related,
          retweet: this.parseQuoteOrRetweet(retweet),
        };
      }
      return twt;
    } else {
      return null;
    }
  }

  async fetchTweets(
    username: string,
    maxRecursive: number = 1,
    config?: { minView?: number },
    fromTimestamp?: number, // timestamp
  ) {
    const DEBUG = true;
    DEBUG &&
      console.log(
        ' =========== Fetch tweets ===========',
        username,
        'maxRecursive',
        maxRecursive,
        'config',
        config,
      );
    let cursor;
    let entries = [];
    const tweets = [];
    let numQuery = 0;
    while (true) {
      entries = await this.getTweetsAnchor(username, cursor);
      numQuery += 1;
      if (entries.length <= 2) break;
      for (const entry of entries) {
        const dt = entry?.content?.content?.tweetResult?.result?.legacy;
        const quote =
          entry?.content?.content?.tweetResult?.result?.quoted_status_result;
        const retweet =
          entry?.content?.content?.tweetResult?.result?.legacy
            ?.retweeted_status_result;
        if (
          (dt &&
            // // NOTE: Exclude retweet
            !dt?.retweeted_status_result &&
            Number(
              entry?.content?.content?.tweetResult?.result?.view_count_info
                ?.count || 0,
            ) >=
              Number(
                config?.minView === undefined ? 10000 : config?.minView,
              )) ||
          // NOTE: retweet always has 0 view
          dt?.retweeted_status_result
        ) {
          const noteTweet =
            entry?.content?.content?.tweetResult?.result?.note_tweet
              ?.note_tweet_results?.result?.text;
          const _twt = {
            tweet_id: entry?.content?.content?.tweetResult?.result?.rest_id,
            post_created: dt.created_at ? new Date(dt.created_at) : undefined,
            content: noteTweet ? noteTweet : dt.full_text,
            favorite_count: dt.favorite_count,
            reply_count: dt.reply_count,
            retweet_count: dt.retweet_count,
            conversation_id: dt.conversation_id_str,
            reply_to_id: dt.in_reply_to_status_id_str,
            views: Number(
              entry?.content?.content?.tweetResult?.result?.view_count_info
                ?.count || 0,
            ),
            media: dt?.extended_entities?.media.map((media) => ({
              media_url_https: media?.media_url_https,
              original_info: media?.original_info,
              type: media?.type,
            })),
            related: undefined,
          };
          if (quote) {
            _twt['related'] = {
              ..._twt.related,
              quote: this.parseQuoteOrRetweet(quote, true),
            };
          }
          if (retweet) {
            _twt['related'] = {
              ..._twt.related,
              retweet: this.parseQuoteOrRetweet(retweet, true),
            };
          }
          tweets.push(_twt);
        }
        if (
          entry?.content?.__typename === 'TimelineTimelineCursor' &&
          entry?.content?.cursorType === 'Bottom'
        ) {
          cursor = entry?.content?.value;
        }
      }
      const oldestTweet = tweets[tweets.length - 1]?.post_created;
      DEBUG &&
        console.log(
          '🚀 ~ RapidTwitterService ~ fetchTweets ~ cursor:',
          cursor,
          maxRecursive,
          numQuery,
          tweets.length,
          username,
          'oldest tweet',
          oldestTweet,
        );
      if (!fromTimestamp) {
        if (maxRecursive <= numQuery) break;
      } else {
        if (oldestTweet.getTime() < fromTimestamp) break;
      }
    }
    return { numQuery, tweets };
  }

  async getTweet(tweetId: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/get-tweet`,
      params: {
        tweet_id: tweetId,
      },
      headers: this._buildHeader(),
    };
    const data = await this.sendRequest(options);
    return data?.data?.tweet_result?.result;
  }

  async getFollowingAnchor(username: string, cursor?: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/user-following`,
      params: {
        username: username,
        cursor: cursor,
        count: 100,
      },
      headers: this._buildHeader(),
    };
    const data = await this.sendRequest(options);
    if (data?.data?.user?.timeline_response?.timeline?.instructions) {
      for (const _ins of data?.data?.user?.timeline_response?.timeline
        ?.instructions) {
        if (_ins?.__typename === 'TimelineAddEntries') return _ins?.entries;
      }
    }
    return [];
  }

  async getFollowerAnchor(username: string, cursor?: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/user-followers`,
      params: {
        username: username,
        cursor: cursor,
        count: 100,
      },
      headers: this._buildHeader(),
    };
    const data = await this.sendRequest(options);
    if (data?.data?.user?.timeline_response?.timeline?.instructions) {
      for (const _ins of data?.data?.user?.timeline_response?.timeline
        ?.instructions) {
        if (_ins?.__typename === 'TimelineAddEntries') return _ins?.entries;
      }
    }
    return [];
  }

  async getListFollower(
    username: string,
    maxRecursive: number = 1,
  ): Promise<TTwitterUserInfo[]> {
    const userFollowings: TTwitterUserInfo[] = [];
    let cursor;
    let entries = [];
    let numQuery = 0;
    while (true) {
      entries = await this.getFollowerAnchor(username, cursor);
      numQuery += 1;
      if (entries.length <= 2) break;
      entries.forEach((entry) => {
        const result = entry?.content?.content?.userResult?.result;
        if (
          result &&
          result?.rest_id &&
          entry?.content?.__typename === 'TimelineTimelineItem'
        ) {
          userFollowings.push({
            rest_id: result?.rest_id,
            is_blue_verified: result?.is_blue_verified,
            username: result?.legacy?.screen_name,
            follower_count: Number(result?.legacy?.followers_count || 0),
            following_count: Number(result?.legacy?.friends_count || 0),
            name: result?.legacy?.name,
            metadata: {
              description: result?.legacy?.description,
              image_url: result?.legacy?.profile_image_url_https.replace(
                '_normal',
                '',
              ),
              banner_url: result?.legacy?.profile_banner_url,
              url: result?.legacy?.url,
            },
          });
        }
        if (
          entry?.content?.__typename === 'TimelineTimelineCursor' &&
          entry?.content?.cursorType === 'Bottom'
        ) {
          cursor = entry?.content?.value;
        }
      });
      console.log(
        '🚀 ~ RapidTwitterService ~ getListFollowing ~ cursor:',
        cursor,
      );
      if (maxRecursive <= numQuery) break;
    }
    return userFollowings;
  }

  async getListFollowing(
    username: string,
    maxRecursive: number = 1,
  ): Promise<TTwitterUserInfo[]> {
    const userFollowings: TTwitterUserInfo[] = [];
    let cursor;
    let entries = [];
    let numQuery = 0;
    while (true) {
      entries = await this.getFollowingAnchor(username, cursor);
      numQuery += 1;
      if (entries.length <= 2) break;
      entries.forEach((entry) => {
        const result = entry?.content?.content?.userResult?.result;
        if (
          result &&
          result?.rest_id &&
          entry?.content?.__typename === 'TimelineTimelineItem'
        ) {
          userFollowings.push({
            rest_id: result?.rest_id,
            is_blue_verified: result?.is_blue_verified,
            username: result?.legacy?.screen_name,
            follower_count: Number(result?.legacy?.followers_count || 0),
            following_count: Number(result?.legacy?.friends_count || 0),
            name: result?.legacy?.name,
            metadata: {
              description: result?.legacy?.description,
              image_url: result?.legacy?.profile_image_url_https.replace(
                '_normal',
                '',
              ),
              banner_url: result?.legacy?.profile_banner_url,
              url: result?.legacy?.url,
            },
          });
        }
        if (
          entry?.content?.__typename === 'TimelineTimelineCursor' &&
          entry?.content?.cursorType === 'Bottom'
        ) {
          cursor = entry?.content?.value;
        }
      });
      console.log(
        '🚀 ~ RapidTwitterService ~ getListFollowing ~ cursor:',
        cursor,
      );
      if (maxRecursive <= numQuery) break;
    }
    return userFollowings;
  }

  async getListFollowing47(
    restId: string,
    isRecursive: boolean = false,
  ): Promise<TTwitterUserInfo[]> {
    // const options = {
    //   method: 'GET',
    //   url: `${this._rapidHost}/following.php`,
    //   params: {
    //     screenname: screen_name,
    //   },
    //   headers: this._buildHeader(),
    // };
    // const { following } = await this.sendRequest(options);
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/user-followings`,
      params: {
        userId: restId,
      },
      headers: this._buildHeader(),
    };
    const userFollowings: TTwitterUserInfo[] = [];
    let data = await this.sendRequest(options);
    let entries = data.entries;
    let cursor = data.cursor;
    while (entries.length && cursor) {
      console.log(
        '🚀 ~ RapidTwitterService ~ getListFollowing ~ cursor:',
        cursor,
      );
      entries.forEach((entry) => {
        const result = entry?.content?.itemContent?.user_results?.result;
        if (result && result?.rest_id)
          userFollowings.push(this.convertTwitterUserData(result));
      });
      data = await this.sendRequest({
        method: 'GET',
        url: `${this._rapidHost}/user-followings`,
        params: {
          userId: restId,
          cursor: cursor,
        },
        headers: this._buildHeader(),
      });
      entries = data.entries;
      cursor = data.cursor;
      if (!isRecursive) break;
    }
    return userFollowings;
  }

  async fetchTweets47(restId: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/user-tweets-and-replies`,
      params: {
        userId: restId,
      },
      headers: this._buildHeader(),
    };
    const { entries } = await this.sendRequest(options);
    const tweets = [];
    entries.forEach((entry) => {
      const dt = entry?.content?.itemContent?.tweet_results?.result?.legacy;
      if (dt)
        tweets.push({
          tweet_id: entry?.content?.itemContent?.tweet_results?.result?.rest_id,
          post_created: new Date(dt.created_at),
          content: dt.full_text,
          favorite_count: dt.favorite_count,
          reply_count: dt.reply_count,
          retweet_count: dt.retweet_count,
        });
    });
    return tweets;
  }

  convertTwitterUserData(result) {
    console.log(result?.legacy?.screen_name);
    return {
      rest_id: result?.rest_id,
      is_blue_verified: result?.is_blue_verified,
      username: result?.legacy?.screen_name,
      follower_count: Number(result?.legacy?.followers_count || 0),
      following_count: Number(result?.legacy?.friends_count || 0),
      name: result?.legacy?.name,
      metadata: {
        description: result?.legacy?.description,
        image_url: result?.legacy?.profile_image_url_https.replace(
          '_normal',
          '',
        ),
        banner_url: result?.legacy?.profile_banner_url,
        url: result?.legacy?.url,
      },
    };
  }

  /**
   *
   * @param restId
   */
  async fetchUserInfo(restId?: string) {
    try {
      const data = await this.sendRequest({
        method: 'GET',
        url: `${this._rapidHost}/get-user-by-id`,
        params: {
          user_id: restId,
        },
        headers: this._buildHeader(),
      } as any);
      return data;
    } catch (error) {
      console.log('error', error);
    }
  }

  async fetchUserInfoByUsername(
    username?: string,
  ): Promise<TwitterUserProfile> {
    try {
      const data = await this.sendRequest({
        method: 'GET',
        url: `${this._rapidHost}/get-user`,
        params: {
          username: username,
        },
        headers: this._buildHeader(),
      } as any);
      return data;
    } catch (error) {
      console.log('error', error);
    }
  }

  async fetchTweetsByUserv2(
    username: string,
    min_view: number = 0,
    max_recursive: number = 1,
    only_db_tweets: boolean = false,
  ) {
    let twitterUser = await this.twitterUserRepository.findOne({
      where: {
        username,
      },
    });
    if (!twitterUser) {
      const _twitterUser = await this.fetchUserInfoByUsername(username);
      twitterUser = await this.twitterUserRepository.save(
        this.convertTwitterUserData({
          legacy: _twitterUser,
          rest_id: _twitterUser?.id_str,
        }),
      );
    }
    const adminConfig =
      await this.adminConfigRepository.findSpecificTwitterUser();

    const resTweets = await this.tweetRepository.find({
      where: {
        twitter_user_id: twitterUser.id,
      },
      order: {
        post_created: 'DESC',
      },
    });
    console.log(
      '======',
      resTweets?.[0]?.created_at.getTime(),
      resTweets?.[0]?.created_at,
      Date.now(),
      new Date(),
    );
    let newTweets = [];
    if (
      !only_db_tweets &&
      (!resTweets?.[0] ||
        resTweets?.[0]?.created_at?.getTime() + 1000 * 60 * 15 < Date.now())
    ) {
      try {
        const { numQuery, tweets: _resTweets } = await this.fetchTweets(
          username,
          resTweets?.length ? 1 : max_recursive,
          { minView: Number(min_view || 0) },
        );
        newTweets = _resTweets;
        (async () => {
          await this.tweetRepository.upsert(
            newTweets.map((tweet) => ({
              ...tweet,
              twitter_user_id: twitterUser.id,
              trackable: adminConfig?.data?.users.includes(username),
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
        })().then(() => {
          console.log(`===== PERSISTED TWEETS of ${username} =====`);
        });
        console.log(`===== FETCHED TWEETS of ${username} =====`);
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
    return { tweets: mergedTweets, info: twitterUser };
  }

  async fetchTweetsByUser(
    username: string,
    min_view: number = 0,
    max_recursive: number = 1,
    only_db_tweets: boolean = false,
  ) {
    let twitterUser = await this.twitterUserRepository.findOne({
      where: {
        username,
      },
      // select: ['id', 'rest_id', 'num_query', 'num_fail_query'],
    });
    if (!twitterUser) {
      const _twitterUser = await this.fetchUserInfoByUsername(username);
      twitterUser = await this.twitterUserRepository.save(
        this.convertTwitterUserData({
          legacy: _twitterUser,
          rest_id: _twitterUser?.id_str,
        }),
      );
    }
    const adminConfig =
      await this.adminConfigRepository.findSpecificTwitterUser();

    let resTweets = [];
    if (!only_db_tweets) {
      try {
        const { numQuery, tweets: _resTweets } = await this.fetchTweets(
          username,
          max_recursive,
          { minView: Number(min_view || 0) },
        );
        resTweets = _resTweets;
        (async () => {
          await this.tweetRepository.upsert(
            resTweets.map((tweet) => ({
              ...tweet,
              twitter_user_id: twitterUser.id,
              trackable: adminConfig?.data?.users.includes(username),
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
        })().then(() => {
          console.log(`===== PERSISTED TWEETS of ${username} =====`);
        });
        console.log(`===== FETCHED TWEETS of ${username} =====`);
      } catch (error) {
        console.log('🚀 ~ UserConsumer ~ error:', error);
        await this.twitterUserRepository.update(
          {
            id: twitterUser.id,
          },
          {
            num_fail_query: twitterUser.num_fail_query + 1,
          },
        );
      }
    } else {
      resTweets = await this.tweetRepository.find({
        where: {
          twitter_user_id: twitterUser.id,
        },
      });
    }
    return { tweets: resTweets, info: twitterUser };
  }

  async getTweetsDetail(tweet_id: string) {
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/get-tweet`,
      params: {
        tweet_id: tweet_id,
      },
      headers: this._buildHeader(),
    };
    const data = await this.sendRequest(options);
    return data?.data?.tweet_result?.result;
  }

  cache = new Map<string, { time: number; data: TwitterEntry[] }>();

  // search curl --location 'https://twttrapi.p.rapidapi.com/search-top?query=%24VOID' \
  async searchLatest(
    query: string,
    cursor?: string,
    mode: 'top' | 'latest' = 'top',
  ): Promise<TwitterEntry[]> {
    const key = `${query}-${cursor}-${mode}`;
    const cached = this.cache.get(key);
    if (cached && cached.time > Date.now() - 1000 * 60 * 5) {
      return cached.data;
    }
    const options = {
      method: 'GET',
      url: `${this._rapidHost}/search-latest`,
      params: { query, cursor } as TwitterSearchParams,
      headers: this._buildHeader(),
    };
    const data: TwitterSearchResponse = await this.sendRequest(options);
    const rs =
      data?.data?.search?.timeline_response?.timeline?.instructions.find(
        (i) => i?.__typename === 'TimelineAddEntries',
      )?.entries;
    return rs;
  }
  configs = {
    1: {
      minReply: 10,
      minFaves: 50,
      minRetweets: 10,
    },
    2: {
      minReply: 2,
      minFaves: 10,
      minRetweets: 5,
    },
    3: {
      minReply: 0,
      minFaves: 0,
      minRetweets: 0,
    },
  };

  async searchTweetMentionCA(
    symbol: string,
    maxRecursive: number = 4,
    retry: number = 1,
    mode: 'top' | 'latest' = 'top',
  ): Promise<SearchTweetMentionCAResponse> {
    let cursor;
    const tweets: {
      tweet_id: string;
      post_created: Date;
      content: string;
      name: string;
      favorite_count: number;
      reply_count: number;
      retweet_count: number;
      conversation_id: string;
      reply_to_id: string;
      views: number;
      media: {
        media_url_https: string;
        original_info: any;
        type: string;
      }[];
      related: any;
    }[] = [];
    let numQuery = 0;
    const config = this.configs[retry];
    const isLog = false;

    while (true) {
      const query = `${config?.minReply > 0 ? `min_replies:${config?.minReply} min_faves:${config?.minFaves} min_retweets:${config?.minRetweets} -` : ''}filter:links -filter:replies #${symbol}`;
      isLog && console.log('Fetching... with query', query, 'cursor', cursor);
      const entries = await this.searchLatest(query, cursor, mode);
      isLog && console.log('Found', entries?.length, 'entries');
      numQuery += 1;

      if (entries && entries?.length) {
        for (const entry of entries) {
          const dt = entry?.content?.content?.tweetResult?.result?.legacy;
          const name =
            entry?.content?.content?.tweetResult?.result?.core?.user_result
              ?.result?.legacy?.name;
          const quote =
            entry?.content?.content?.tweetResult?.result?.quoted_status_result;
          const retweet =
            entry?.content?.content?.tweetResult?.result?.legacy
              ?.retweeted_status_result;
          if (
            dt &&
            // // NOTE: Exclude retweet
            !dt?.retweeted_status_result
          ) {
            const noteTweet =
              entry?.content?.content?.tweetResult?.result?.note_tweet
                ?.note_tweet_results?.result?.text;
            const _twt = {
              tweet_id: entry?.content?.content?.tweetResult?.result?.rest_id,
              post_created: dt.created_at ? new Date(dt.created_at) : undefined,
              content: noteTweet ? noteTweet : dt.full_text,
              name,
              favorite_count: dt.favorite_count,
              reply_count: dt.reply_count,
              retweet_count: dt.retweet_count,
              conversation_id: dt.conversation_id_str,
              reply_to_id: dt.in_reply_to_status_id_str,
              views: Number(
                entry?.content?.content?.tweetResult?.result?.view_count_info
                  ?.count || 0,
              ),
              media: dt?.extended_entities?.media.map((media) => ({
                media_url_https: media?.media_url_https,
                original_info: media?.original_info,
                type: media?.type,
              })),
              related: undefined,
            };
            if (quote) {
              _twt['related'] = {
                ..._twt.related,
                quote: this.parseQuoteOrRetweet(quote, true),
              };
            }
            if (retweet) {
              _twt['related'] = {
                ..._twt.related,
                retweet: this.parseQuoteOrRetweet(retweet, true),
              };
            }
            tweets.push(_twt);
          }
          if (
            entry?.content?.__typename === 'TimelineTimelineCursor' &&
            entry?.content?.cursorType === 'Bottom'
          ) {
            cursor = entry?.content?.value;
          }
        }

        if (tweets.length >= 40) {
          break;
        } else {
          if (maxRecursive <= numQuery) break;
        }
      } else {
        break;
      }
    }

    const last5Tweets = tweets
      .sort((a, b) => b?.post_created.getTime() - a?.post_created.getTime())
      .slice(0, 5);

    const oneDay = 1000 * 60 * 60 * 24;
    const recentTweet = tweets.filter(
      (t) => t.post_created.getTime() > Date.now() - oneDay,
    );
    isLog && console.log('Found', recentTweet.length, 'recent tweets');
    isLog &&
      console.log(
        'Oldest of recentTweet',
        recentTweet.sort(
          (a, b) => a.post_created.getTime() - b.post_created.getTime(),
        )[0]?.post_created,
      );

    if (!recentTweet || recentTweet.length < 5) {
      if (!config.minReply) {
        return {
          tweets,
          numQuery,
        };
      }
      return this.searchTweetMentionCA(symbol, maxRecursive, retry + 1, mode);
    }

    if (tweets.length === 0) {
      if (!config.minReply) {
        return { tweets: [], numQuery };
      }

      return this.searchTweetMentionCA(symbol, maxRecursive, retry + 1, mode);
    }

    return { tweets, numQuery };
  }
}
