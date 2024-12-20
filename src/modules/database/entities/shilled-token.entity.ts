import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TweetEntity } from './tweet.entity';

@Unique(['symbol', 'post_created'])
@Entity('shilled_tokens')
export class ShilledTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  symbol: string;

  @Column()
  @Index()
  tweet_id: string;

  @ManyToOne(() => TweetEntity)
  @JoinColumn({ name: 'tweet_id' })
  tweet: TweetEntity;

  @Column({ nullable: true })
  username: string;

  @Column({ type: 'float' })
  related_score: number;

  @Column({ type: 'float' })
  positive_score: number;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  post_created: Date;

  @Column()
  favorite_count: number;

  @Column()
  reply_count: number;

  @Column()
  retweet_count: number;

  @Column()
  insights: string;

  @Column()
  reason: string;
}
