import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseModule } from '@/database';
import { ConfigModule } from '@nestjs/config';
import { CrawlerModule } from '@/crawler/crawler.module';
import { QueueModule } from '@/queue/queue.module';
import { TokenService } from './services/token.service';
import { TweetService } from './services/tweet.service';

const services = [TokenService, TweetService];
@Module({
  imports: [
    DatabaseModule,
    CrawlerModule,
    QueueModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [],
    }),
    // JwtModule.registerAsync({
    //   useFactory: (configService: ConfigService) => ({
    //     secret: configService.get<string>('auth.key.jwt_secret_key'),
    //     global: true,
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  providers: [...services],
  exports: [...services],
})
export class BusinessModule implements OnApplicationBootstrap {
  constructor() {}

  async onApplicationBootstrap() {}
}
