import {
  AdminConfigRepository,
  MyTweetRepository,
  TwitterPostRepository,
  TwitterUserRepository,
} from '@/database/repositories';
import {
  OnApplicationBootstrap,
  Inject,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { QueryTweetsResponse, Scraper, SearchMode } from 'agent-twitter-client';
import { CreateTwitterUserDto } from '../dtos/create-twitter-user.dto';
import { ConfigService } from '@nestjs/config';
import { CreateTwitterUserWithCookiesDto } from '../dtos/create-twitter-user-with-cookies.dto';
import axios from 'axios';
import { AiService } from '@/ai/services/ai.service';
import { ETwitterPostStatus } from '@/shared/constants/enums';
import { Interval } from '@nestjs/schedule';
import { CreateTweetResponse } from '../interfaces/twitter.interface';
import { generateImage } from '@/shared/generate-image';

class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing: boolean = false;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      try {
        await request();
      } catch (error) {
        console.error('Error processing request:', error);
        this.queue.unshift(request);
        await this.exponentialBackoff(this.queue.length);
      }
      await this.randomDelay();
    }

    this.processing = false;
  }

  private async exponentialBackoff(retryCount: number): Promise<void> {
    const delay = Math.pow(2, retryCount) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 2000) + 1500;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export class TwitterService implements OnApplicationBootstrap {
  private isRunning: boolean = false;
  private scrapers: Map<string, Scraper> = new Map();
  private readonly secretKey: string;
  requestQueue: RequestQueue = new RequestQueue();
  isReady: boolean = false;

  constructor(
    @Inject(TwitterUserRepository)
    private readonly twitterUserRepository: TwitterUserRepository,
    private readonly configService: ConfigService,
    @Inject(AdminConfigRepository)
    private readonly adminConfigRepository: AdminConfigRepository,
    private aiService: AiService,
    @Inject(TwitterPostRepository)
    private readonly twitterPostRepository: TwitterPostRepository,
    @Inject(MyTweetRepository)
    private readonly myTweetRepository: MyTweetRepository,
  ) {
    this.secretKey = this.configService.get('twitterApi.secretKey');
  }
  async onApplicationBootstrap() {}

  async post(
    content?: string,
    replyToTweetId?: string,
    mediaData?: {
      data: Buffer;
      mediaType: string;
    }[],
  ): Promise<CreateTweetResponse> {
    const keys = [...this.scrapers.keys()];
    let scraper;
    if (keys.length === 1) {
      scraper = this.scrapers.get(keys[0]);
    } else {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      scraper = this.scrapers.get(randomKey);
    }
    if (!scraper) {
      throw new Error('Scraper not found');
    }
    const rs = await scraper.sendTweet(content, replyToTweetId, mediaData);
    const json = await rs.json();
    return json;
  }

  // async postWithMedia(username?: string, content?: string, media?: string) {
  //   const scraper = this.scrapers.get('404flipping');
  //   if (!scraper) {
  //     throw new Error('Scraper not found');
  //   }
  //   const image = fs.readFileSync('icon.png');

  //   // Example: Sending a tweet with media attachments
  //   const mediaData = [
  //     {
  //       data: image,
  //       mediaType: 'image/jpeg',
  //     },
  //   ];

  //   await scraper.sendTweet('Hello world!', undefined, mediaData);
  // }

  async start() {
    if (this.isReady) {
      return;
    }
    console.log('Initializing Twitter scrapers');

    const cookies = await this.adminConfigRepository.findOneByKey(
      'twitter-client-cookies',
    );

    try {
      if (cookies) {
        await this.createUserWithCookies({
          username: cookies?.data.username,
          guest_id: cookies?.data.guest_id,
          kdt: cookies?.data.kdt,
          twid: cookies?.data.twid,
          ct0: cookies?.data.ct0,
          auth_token: cookies?.data.auth_token,
        });
      }
    } catch (error) {
      console.error('Error initializing Twitter scrapers:', error);
    }

    this.isReady = true;
  }

  async createUser(data: CreateTwitterUserDto) {
    try {
      // Check if username already exists
      const existingUser = await this.twitterUserRepository.findOne({
        where: { username: data.username },
      });

      if (existingUser) {
        throw new ConflictException('Username already exists');
      }

      console.log('Logging in to Twitter...');
      const login = await this.login(data.username, data.password, data.email);
      console.log('Logged in to Twitter...');
      if (!login) {
        throw new BadRequestException('Invalid username or password');
      }
      console.log('Setting scraper...');
      this.scrapers.set(login.username, login.scraper);
      console.log('Scraper set...');
      // Create new user with encrypted password
      console.log('Creating new user...');
      console.log('New user created...');
      return true;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async createUserWithCookies(data: CreateTwitterUserWithCookiesDto) {
    try {
      // Check if username already exists
      // const existingUser = await this.twitterUserRepository.findOne({
      //   where: { username: data.username },
      // });

      // if (existingUser) {
      //   throw new ConflictException('Username already exists');
      // }

      const scraper = new Scraper({});
      const cookieStrings = [
        `guest_id=${data.guest_id}; Domain=twitter.com; Path=/; Secure; ; SameSite=none`,
        `kdt=${data.kdt}; Domain=twitter.com; Path=/; Secure; HttpOnly; SameSite=Lax`,
        `twid="u=${data.twid}"; Domain=twitter.com; Path=/; Secure; ; SameSite=none`,
        `ct0=${data.ct0}; Domain=twitter.com; Path=/; Secure; ; SameSite=lax`,
        `auth_token=${data.auth_token}; Domain=twitter.com; Path=/; Secure; HttpOnly; SameSite=none`,
        `att=1-j9tVvDhZ8SvRkTJg5vb7g43onTh2hnDxAdGSkIUO; Domain=twitter.com; Path=/; Secure; HttpOnly; SameSite=none`,
      ];

      await scraper.setCookies(cookieStrings);

      if (!(await scraper.isLoggedIn())) {
        throw new BadRequestException('Invalid cookies');
      }

      this.scrapers.set(data.username, scraper);
      return true;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  private async login(username: string, password: string, email: string) {
    try {
      const scraper = new Scraper();

      let maxAttempts = 5;
      while (maxAttempts > 0) {
        console.log(
          'Logging in to Twitter...',
          username,
          'username',
          password,
          'password',
          email,
          'email',
        );
        await scraper.login(username, password, email);
        console.log('Logged in to Twitter...');

        if (await scraper.isLoggedIn()) {
          console.log('Getting cookies...');
          const cookies = await scraper.getCookies();
          console.log('Got cookies...');
          const cookieStrings = cookies.map(
            (cookie: any) =>
              `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${
                cookie.path
              }; ${cookie.secure ? 'Secure' : ''}; ${
                cookie.httpOnly ? 'HttpOnly' : ''
              }; SameSite=${cookie.sameSite || 'Lax'}`,
          );
          console.log('Got cookies...');
          return { username, scraper, cookies: cookieStrings };
        }
        console.error('Failed to login to Twitter trying again...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log(
          'Waiting 2 seconds before trying again...',
          maxAttempts,
          'maxAttempts',
        );
        maxAttempts--;
      }

      return null;
    } catch (error) {
      throw error.message;
    }
  }

  private async fetchSearchTweets(
    query: string,
    maxTweets: number,
    searchMode: SearchMode,
    cursor?: string,
  ): Promise<QueryTweetsResponse> {
    if (!this.isReady) {
      await this.start();
    }
    // @dev: any key is good for search, we use a random scraper to avoid being rate limited
    const keys = [...this.scrapers.keys()];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const scraper = this.scrapers.get(randomKey);
    if (!scraper) {
      throw new Error('Scraper not found');
    }
    try {
      // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
      // if we dont get a response in 10 seconds, something is wrong
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ tweets: [] }), 10000),
      );

      try {
        const result = await this.requestQueue.add(
          async () =>
            await Promise.race([
              scraper.fetchSearchTweets(query, maxTweets, searchMode, cursor),
              timeoutPromise,
            ]),
        );
        return (result ?? { tweets: [] }) as QueryTweetsResponse;
      } catch (error) {
        return { tweets: [] };
      }
    } catch (error) {
      return { tweets: [] };
    }
  }

  async interaction() {
    const handleTwitterInteractionsLoop = async () => {
      const listenHandles =
        await this.adminConfigRepository.findOneByKey('listen_handles');
      console.log('listenHandles', listenHandles);
      if (!listenHandles) {
        return;
      }
      const handles = listenHandles.data as string[];
      for (const handle of handles) {
        const keys = [...this.scrapers.keys()];
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const scraper = this.scrapers.get(randomKey);
        if (scraper) {
          this.crawlTwitterInteractions(handle, scraper);
        }
      }
      setTimeout(handleTwitterInteractionsLoop, 60 * 1000); // Random interval between 1 minutes
    };
    handleTwitterInteractionsLoop();
  }

  async crawlTwitterInteractions(username: string, scraper: Scraper) {
    console.log('Starting crawl twitter interactions for username:', username);
    const twitterUsername = username;
    try {
      // Check for mentions
      const tweetCandidates = (
        await this.fetchSearchTweets(
          `@${twitterUsername}`,
          20,
          SearchMode.Latest,
        )
      ).tweets;
      const profile = await scraper.getProfile(twitterUsername);

      // de-duplicate tweetCandidates with a set
      let uniqueTweetCandidates = [...new Set(tweetCandidates)];
      // Sort tweet candidates by ID in ascending order
      uniqueTweetCandidates = uniqueTweetCandidates
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((tweet) => tweet.userId !== profile.userId);

      const lastCheckedTweet =
        await this.adminConfigRepository.findOneByKey('last-checked-tweet');

      const lastCheckedTweetId = BigInt(lastCheckedTweet?.value || 0);

      const newTweets = [];
      // for each tweet candidate, handle the tweet
      for (const [index, tweet] of uniqueTweetCandidates.entries()) {
        console.log(
          `Processing tweet ${index + 1} of ${uniqueTweetCandidates.length}`,
        );
        console.log('Tweet ID:', tweet.id);
        console.log('Last checked tweet ID:', lastCheckedTweetId);
        if (!lastCheckedTweetId || BigInt(tweet.id) > lastCheckedTweetId) {
          // TODO: handle the tweet
          console.log('Handling tweet...');
          console.log('Tweet:', tweet.text);
          newTweets.push({
            character_username: twitterUsername,
            tweet_id: Number(tweet.id),
            bookmark_count: tweet.bookmarkCount,
            conversation_id: tweet.conversationId,
            hashtags: tweet.hashtags,
            html: tweet.html,
            in_reply_to_status_id: tweet.inReplyToStatusId,
            is_quoted: tweet.isQuoted,
            is_pin: tweet.isPin,
            is_reply: tweet.isReply,
            is_retweet: tweet.isRetweet,
            is_self_thread: tweet.isSelfThread,
            likes: tweet.likes,
            name: tweet.name,
            mentions: tweet.mentions,
            permanent_url: tweet.permanentUrl,
            permanent_id: tweet.permanentUrl.split('/').pop(),
            photos: tweet.photos,
            quoted_status_id: tweet.quotedStatusId,
            replies: tweet.replies,
            retweets: tweet.retweets,
            retweeted_status_id: tweet.retweetedStatusId,
            text: tweet.text,
            thread: tweet.thread,
            timestamp: tweet.timestamp,
            urls: tweet.urls,
            user_id: tweet.userId,
            username: tweet.username,
            videos: tweet.videos,
            views: tweet.views,
            sensitive_content: tweet.sensitiveContent,
          });
          console.log('Saving last checked tweet ID...');

          await this.adminConfigRepository.update(
            { key: 'last-checked-tweet' },
            { value: tweet.id },
          );

          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log('Last checked tweet ID saved...');
        }
      }

      await this.twitterPostRepository.upsert(newTweets, {
        conflictPaths: ['tweet_id'],
      });
    } catch (error) {
      console.error('Error crawling Twitter interactions:', error);
    }
  }

  @Interval(1000 * 5)
  async handleTwitterInteractions() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    const debug = Number(
      (
        await this.adminConfigRepository.findOneByKey(
          'debug_mode_twitter_interaction',
        )
      )?.value || 0,
    );
    const post = await this.twitterPostRepository.findOne({
      where: {
        status: ETwitterPostStatus.Init,
      },
      order: {
        tweet_id: 'ASC',
      },
    });
    if (!post) {
      debug && console.log('No post to handle');
      this.isRunning = false;
      return;
    }

    try {
      debug &&
        console.log('Handling post', post.tweet_id, post.character_username);
      await this.twitterPostRepository.update(post.id, {
        status: ETwitterPostStatus.Processing,
      });
      debug && console.log('Updated post status to Processing');

      debug && console.log('Getting reply...');

      const content = post.text;

      const threadHistory = await this.twitterPostRepository.find({
        where: {
          conversation_id: post.conversation_id,
        },
        order: {
          timestamp: 'ASC',
        },
        select: {
          username: true,
          text: true,
          reply_content: true,
        },
      });

      const threadHistoryBuild = threadHistory.map((item) => ({
        username: item.username,
        text: item.text,
        reply_content: item.reply_content,
      }));

      const {
        result: isQuestion,
        thread,
        content: agentCheckContent,
      } = await this.aiService.checkIsQuestion(
        post.character_username,
        content,
        threadHistoryBuild,
      );

      const replyId =
        post.permanent_id ||
        post.permanent_url.split('/').pop() ||
        post.conversation_id;

      const updated = {
        status: ETwitterPostStatus.Success,
        thread_history: thread as any,
        is_question: isQuestion,
        agent_check_question_result: agentCheckContent as any,
      };

      if (!post.permanent_id) {
        updated['permanent_id'] = replyId;
      }

      if (isQuestion) {
        const response = await this.aiService.generateReplyTweetv3({
          question: post.text,
          conversationId: post.conversation_id,
        });

        if (response.status == 500) {
          this.isRunning = false;
          return;
        }

        const rs = await this.post(response, replyId);

        if (rs.errors) {
          throw new Error(rs.errors[0].message);
        }
        updated['reply_content'] = response;
      } else {
        console.log('Not a question');
      }
      await this.twitterPostRepository.update(post.id, updated);
      debug && console.log('Updated post status to Success');
    } catch (error) {
      await this.twitterPostRepository.update(post.id, {
        status: ETwitterPostStatus.Failed,
        error_message: error.message,
      });
      debug && console.log('Updated post status to Failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  async getImage(text: string): Promise<Buffer> {
    const style = Math.floor(Math.random() * 3) + 1;
    const TIMEOUT_DURATION = 1000 * 60 * 10; // 10 minutes in milliseconds

    try {
      const response = await axios.get(
        `${process.env.GEN_X_VIDEO_SERVER_URL}/video/download-video-v2`,
        {
          params: {
            style,
            recordTime: 20000,
            text,
          },
          responseType: 'arraybuffer',
          timeout: 1000 * 20 * 60, // 20 minutes
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error(
          `Request timed out after ${TIMEOUT_DURATION / 1000} seconds`,
        );
      }
      console.error('Error fetching image:', error);
      throw error;
    }
  }

  async continuousTweet() {
    const generateNewTweetLoop = async () => {
      const config =
        await this.adminConfigRepository.findOneByKey('continuous-tweet');
      const isActive = config?.value === 'active';
      if (!isActive) {
        return;
      }
      const lastPostTimestamp = config?.data?.last_post || 0;
      const minMinutes = parseInt(config?.data?.post_interval_min) || 90;
      const maxMinutes = parseInt(config?.data?.post_interval_max) || 180;
      const randomMinutes =
        Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
      const isLog = false;
      if (isLog) {
        console.log(lastPostTimestamp, 'lastPostTimestamp');
        console.log(minMinutes, 'minMinutes');
        console.log(maxMinutes, 'maxMinutes');
        console.log(randomMinutes, 'randomMinutes');
      }
      const delay = randomMinutes * 60 * 1000;
      isLog && console.log(delay, 'delay');

      if (Date.now() > lastPostTimestamp + delay) {
        await this.generateNewTweet();
      }

      setTimeout(() => {
        generateNewTweetLoop(); // Set up next iteration
      }, delay);
    };
    const config =
      await this.adminConfigRepository.findOneByKey('continuous-tweet');
    const isActive = config?.value === 'active';
    if (!isActive) {
      return;
    }
    let postImmediately = false;
    if (config?.data?.post_immediately) {
      postImmediately = true;
    }
    console.log('postImmediately', postImmediately);

    if (postImmediately) {
      await this.generateNewTweet();
    }

    generateNewTweetLoop();
  }

  @Interval(1000 * 60 * 5)
  async cronTweet() {
    if (!this.isReady) {
      return;
    }
    const config = await this.adminConfigRepository.findOneByKey('cron-tweet');
    const isActive = config?.value === 'active';
    if (!isActive) {
      return;
    }
    const nextTime = new Date(config?.data?.next_time);
    if (Date.now() > nextTime.getTime()) {
      await this.generateNewTweet();
      await this.adminConfigRepository.update(
        { key: 'cron-tweet' },
        {
          data: {
            ...config?.data,
            next_time: new Date(
              nextTime.getTime() + 1000 * 60 * 60 * 24,
            ).toISOString(),
          } as any,
        },
      );
    }
  }

  async generateNewTweet() {
    const DEBUG = false;
    if (!this.isReady) {
      DEBUG && console.log('Not ready to generate new tweet');
      return;
    }
    DEBUG && console.log('Generating new tweet...');
    const obj = {};
    try {
      const {
        answer,
        question,
        formattedPrompt: formattedPromptQuestion,
        formattedPromptAnswer: formattedPromptAnswer,
      } = await this.aiService.generateNewV2();

      DEBUG && console.log('Generated tweet...');

      obj['content'] = answer;
      obj['answer'] = answer;
      obj['question'] = question;
      obj['formatted_prompt_question'] = formattedPromptQuestion;
      obj['formatted_prompt_answer'] = formattedPromptAnswer;

      let images;
      if (Math.random() < 0.3) {
        images = await generateImage(answer);
      }

      DEBUG && console.log('Posting tweet...');

      const posted = await this.post(answer, undefined, images);

      DEBUG && console.log('Tweet posted...');

      await Promise.all([
        this.myTweetRepository.save({
          rest_id: posted.data.create_tweet.tweet_results.result.rest_id,
          ...obj,
        }),
      ]);

      DEBUG && console.log('Tweet saved...');
    } catch (error) {
      DEBUG && console.error('Error generating new tweet:', error);
      await this.myTweetRepository.save({
        rest_id: null,
        ...obj,
        error_message: error?.message,
      });
    }
  }
}
