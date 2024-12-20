import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TwitterUserEntity } from './twitter-user.entity';

@Entity('tweets')
export class TweetEntity extends BaseEntity {
  @Column()
  content: string;

  @Column({
    nullable: false,
    unique: true,
  })
  @Index()
  tweet_id: string;

  @Column({
    nullable: true,
  })
  @Index()
  conversation_id: string;

  @Column({
    nullable: true,
  })
  reply_to_id: string;

  @Column({ nullable: true })
  @Index()
  post_created: Date;

  @Column({ type: 'float' })
  favorite_count: number;

  @Column({ type: 'float' })
  reply_count: number;

  @Column({ type: 'float' })
  retweet_count: number;

  @Column({ name: 'views', nullable: true })
  @Index()
  views: number;

  @Column({ nullable: true, type: 'simple-json', name: 'media' })
  media: any;

  @Column({ default: false })
  is_tracked: boolean;

  @Column({ default: true })
  trackable: boolean;

  @Column()
  @Index()
  twitter_user_id: string;

  @ManyToOne(() => TwitterUserEntity, (entity) => entity.tweets)
  @JoinColumn({ name: 'twitter_user_id' })
  twitter_user: TwitterUserEntity;

  @Column('simple-json', { nullable: true })
  related: Record<string, any>;
}
