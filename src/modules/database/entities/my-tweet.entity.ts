import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('my_tweets')
export class MyTweetEntity extends BaseEntity {
  @Column({ unique: true, nullable: true })
  @Index()
  rest_id: string;

  @Column({ nullable: true })
  content: string;

  @Column({ nullable: true })
  question: string;

  @Column({ nullable: true })
  answer: string;

  @Column({ nullable: true })
  formatted_prompt_question: string;

  @Column({ nullable: true })
  formatted_prompt_answer: string;

  @Column({ nullable: true, type: 'simple-json' })
  error_message: any;
}
