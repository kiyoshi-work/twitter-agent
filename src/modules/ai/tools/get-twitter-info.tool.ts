import { Inject, Injectable } from '@nestjs/common';
import { Tool } from 'langchain/tools';
import * as z from 'zod';
import { BaseTool } from './base.tool';
import { TweetService } from '@/business/services/tweet.service';
import { stat } from 'fs';

@Injectable()
export class GetTwitterInfoTool extends BaseTool {
  @Inject(TweetService)
  private readonly tweetService: TweetService;

  // NOTE: defined type of config here
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'get_tweet_info_of_user';
  description = `Get tweets of user`;

  nameToken = '';

  schema = z.object({
    username: z.string().describe('This is twitter username'),
  }) as any;

  async _call(input: any) {
    try {
      if (input?.username) {
        const { tweets, info } =
          await this.tweetService.getTweetsAndInfoByUsername(
            input?.username?.replace(/^@/, ''),
            { max_recursive: 5 },
          );
        return JSON.stringify({
          status: 200,
          data: {
            tweets: tweets.map((tweet) => ({
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
            info,
          },
        });
      } else {
        console.log('not found twitter username');
        return JSON.stringify({
          error: `not found twitter username of ${input?.username?.replace(/^@/, '')}`,
          status: 400,
        });
      }
    } catch (error) {
      return JSON.stringify({
        error: 'error',
        status: 400,
      });
    }
  }
}
