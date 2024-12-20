import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { TTwitterUserMetadata } from '@/shared/types';
import { BaseEntity } from './base.entity';
import { TweetEntity } from './tweet.entity';

@Entity('twitter_users')
export class TwitterUserEntity extends BaseEntity {
  @Column({ nullable: true })
  username: string;

  // @OneToOne(() => UserEntity, (user) => user.twitter_user)
  // user: UserEntity;

  @Column({ default: 0 })
  @Index()
  follower_count: number;

  @Column({ default: 0 })
  following_count: number;

  @Column({ default: 0 })
  num_query: number;

  @Column({ default: 0 })
  num_fail_query: number;

  @Column({ nullable: false, unique: true })
  @Index()
  rest_id: string;

  @Column({ nullable: true })
  @Index()
  last_fetch_tweet: Date;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  profile_image_url: string;

  @OneToMany(() => TweetEntity, (entity) => entity.twitter_user)
  tweets: TweetEntity[];

  @Column('simple-json', { nullable: true })
  metadata: TTwitterUserMetadata;

  @Column({ default: false })
  is_blue_verified: boolean;

  @Column({ default: true })
  is_crawl: boolean;
}
