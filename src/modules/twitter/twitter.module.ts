import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configTwitter } from './configs';
import { DatabaseModule } from '@/database';
import { TwitterService } from './services/twitter.service';
import { TwitterController } from './controllers';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from '@/ai/ai.module';

const isTwitterAuto = Boolean(Number(process.env.IS_TWITTER_AUTO || 0));
const services = [TwitterService];

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configTwitter],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [TwitterController],
  providers: [...services],
  exports: [],
})
export class TwitterModule implements OnApplicationBootstrap {
  constructor(private readonly twitterService: TwitterService) {}
  async onApplicationBootstrap() {
    if (isTwitterAuto) {
      await this.twitterService.start();
      await this.twitterService.interaction();
      await this.twitterService.continuousTweet();
    }
  }
}
