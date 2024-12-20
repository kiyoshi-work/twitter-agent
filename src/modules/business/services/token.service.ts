import { GetTokenPopularDTO } from '@/api/dtos/token.dto';
import { TweetRepository } from '@/database/repositories';
import { PaginateDto } from '@/shared/pagination/paginate.dto';
import { getOffset } from '@/shared/pagination/pagination';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EntityManager, In } from 'typeorm';

@Injectable()
export class TokenService {
  constructor(
    @InjectPinoLogger(TokenService.name)
    private readonly logger: PinoLogger,
    @InjectEntityManager() private readonly entityManager: EntityManager,
    private readonly tweetRepository: TweetRepository,
  ) {}

  async getShilledTokens(query: GetTokenPopularDTO) {
    let queryString = `SELECT symbol, avg_popularity_score, total_favorite_count, total_reply_count, total_retweet_count, avg_post_created, post_count from token_popular `;
    if (query.from_date) {
      queryString += `WHERE created_at >= '${query.from_date} '`;
    }
    if (query.to_date) {
      queryString += `AND created_at <= '${query.to_date} '`;
    }
    if (query.sort_field) {
      queryString += `ORDER BY ${query.sort_field} ${query.sort_type} `;
    } else {
      queryString += `ORDER BY avg_popularity_score DESC, avg_post_created DESC `;
    }
    if (query.take && query.take !== -1) {
      queryString += `LIMIT ${query.take} OFFSET ${getOffset(query.take, query.page)} `;
    }
    const shillToken = this.entityManager.query(queryString);
    return shillToken;
  }

  async getToken(symbol: string, query: PaginateDto) {
    const tokens = await this.entityManager.query(
      `SELECT symbol, avg_popularity_score, total_favorite_count, total_reply_count, total_retweet_count, tweet_ids, avg_post_created, post_count from token_popular WHERE symbol = '${symbol}' lIMIT 1`,
    );
    if (!tokens?.length) throw new BadRequestException('Symbol not found');
    const tweets = await this.tweetRepository.find({
      where: {
        id: In(tokens?.[0]?.tweet_ids),
      },
      select: [
        'id',
        'post_created',
        'content',
        'tweet_id',
        'views',
        'related',
        'twitter_user_id',
        'favorite_count',
      ],
      relations: ['twitter_user'],
      order: { favorite_count: 'DESC' },
      take: query.take,
    });
    return { ...tokens?.[0], tweets };
  }
}
