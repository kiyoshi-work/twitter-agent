import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MyTweetEntity,
  TokenInfoEntity,
  TwitterPostEntity,
  UserEntity,
} from '@/database/entities';
import {
  AdminConfigRepository,
  MyTweetRepository,
  ShilledTokenRepository,
  TokenInfoRepository,
  TweetRepository,
  TwitterPostRepository,
  TwitterUserRepository,
  UserRepository,
} from './repositories';
import { AdminConfigEntity } from './entities/admin-config.entity';
import { SeedDatabase } from './seeders/seed.database';
import { TweetEntity } from './entities/tweet.entity';
import { TwitterUserEntity } from './entities/twitter-user.entity';
import { ShilledTokenEntity } from './entities/shilled-token.entity';

const repositories = [
  UserRepository,
  AdminConfigRepository,
  TweetRepository,
  TwitterUserRepository,
  ShilledTokenRepository,
  TwitterPostRepository,
  TokenInfoRepository,
  MyTweetRepository,
];

const services = [];

const entities = [
  UserEntity,
  AdminConfigEntity,
  TweetEntity,
  TwitterUserEntity,
  ShilledTokenEntity,
  TwitterPostEntity,
  TokenInfoEntity,
  MyTweetEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule {}
