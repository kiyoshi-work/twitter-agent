import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { configCrawler } from './configs/crawler';
import { ConfigModule } from '@nestjs/config';
import { RapidTwitterService } from './services/rapid-twitter.service';
import { DatabaseModule } from '@/database';
import { TweetRepository } from '@/database/repositories';
import { RapidTwitter45Service } from './services/rapid-twitter45.service';
import { CoingeckoService } from './services/coingecko.service';
import { BirdEyeService } from './services/birdeye.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configCrawler],
    }),
  ],
  providers: [
    RapidTwitterService,
    RapidTwitter45Service,
    CoingeckoService,
    BirdEyeService,
  ],
  exports: [
    RapidTwitterService,
    RapidTwitter45Service,
    CoingeckoService,
    BirdEyeService,
  ],
})
export class CrawlerModule implements OnApplicationBootstrap {
  constructor(
    private readonly rapidTwitterService: RapidTwitterService,
    private readonly tweetRepository: TweetRepository,
    private readonly coingeckoService: CoingeckoService,
  ) {}
  async onApplicationBootstrap() {
    // const m = await this.rapidTwitterService.fetchTweetsByUser('0x_Doflamingo');
    // console.log(
    //   '🚀 ~ CrawlerModule ~ onApplicationBootstrap ~ m:',
    //   JSON.stringify(m),
    // );
    // const response = await this.coingeckoService.fetchTop100Coin();
    // console.log(response, 'response');
  }
}
