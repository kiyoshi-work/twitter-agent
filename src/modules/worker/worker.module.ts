import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configQueue } from './configs';
import { DatabaseModule } from '@/database';
import { ScheduleService } from './schedulers/schedule.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from '@/api';
import { BullModule } from '@nestjs/bull';
import { UserConsumer } from './consumers';
import { CrawlTwitterScheduleService } from './schedulers/crawl-twitter.scheduler.service';
import { CrawlerModule } from '@/crawler/crawler.module';
import { TweetRepository } from '@/database/repositories';
import { AiModule } from '@/ai/ai.module';
import { TwitterModule } from '@/twitter/twitter.module';
import { RedisCacheModule } from '@/redis-cache/redis-cache.module';
import { PGVectorModule } from 'modules/pgvector-db/pgvector.module';

const isWorker = Boolean(Number(process.env.IS_WORKER || 0));

let consumers = [];
let schedulers = [];

if (isWorker) {
  consumers = [UserConsumer];
  schedulers = [
    ScheduleService,
    // CrawlTwitterScheduleService,
  ];
}

@Module({
  imports: [
    ApiModule,
    DatabaseModule,
    PGVectorModule,
    TwitterModule,
    CrawlerModule,
    RedisCacheModule,
    AiModule,
    BullModule.forRootAsync({
      imports: [ConfigModule, DatabaseModule],
      useFactory(config: ConfigService) {
        const host = config.get<string>('queue.host');
        const port = config.get<number>('queue.port');
        const db = config.get<number>('queue.database');
        const password = config.get<string>('queue.password');
        // const tls = config.get('queue.tls');
        return {
          redis: {
            host: host,
            port: port,
            db: db,
            password: password,
            // tls,
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configQueue],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [...consumers, ...schedulers],
  exports: [],
})
export class WorkerModule implements OnApplicationBootstrap {
  constructor(private readonly tweetRepository: TweetRepository) {}
  async onApplicationBootstrap() {
    //   const m = await this.tweetRepository.findOne({
    //     where: {
    //       // is_tracked: false,
    //       // id: '8a26a333-8e1c-43a3-92a4-f4f2004a49eb',
    //       id: 'e49bec40-8e39-4013-8cd0-775d0d5af2a2',
    //     },
    //     relations: ['twitter_user'],
    //   });
    //   console.log(
    //     '🚀 ~ WorkerModule ~ onApplicationBootstrap ~ m:',
    //     JSON.stringify(m),
    //   );
  }
}
