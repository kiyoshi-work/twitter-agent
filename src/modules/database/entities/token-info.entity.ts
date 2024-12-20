import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface Website {
  label: string;
  url: string;
}

export interface Social {
  type: string;
  url: string;
}

@Entity('token_info')
export class TokenInfoEntity extends BaseEntity {
  @Column({ nullable: true, unique: true })
  @Index()
  symbol: string;

  @Column({ nullable: true })
  name: string;

  // Pair fields
  @Column({ nullable: true })
  chain_id: string;

  @Column({ nullable: true })
  dex_id: string;

  @Column({ nullable: true })
  url: string;

  @Column({ nullable: true })
  pair_address: string;

  @Column('text', { array: true, nullable: true })
  labels: string[];

  // Spread baseToken fields with prefix
  @Column({ nullable: true })
  base_address: string;

  @Column({ nullable: true })
  base_name: string;

  @Column({ nullable: true })
  base_symbol: string;

  // Spread quoteToken fields with prefix
  @Column({ nullable: true })
  quote_address: string;

  @Column({ nullable: true })
  quote_name: string;

  @Column({ nullable: true })
  quote_symbol: string;

  @Column({ nullable: true })
  price_native: string;

  @Column({ nullable: true })
  price_usd: string;

  @Column({ nullable: true })
  fdv: number;

  @Column({ nullable: true })
  market_cap: number;

  @Column({ nullable: true, type: 'bigint' })
  pair_created_at: number;

  // Transaction fields
  @Column({ nullable: true, type: 'bigint' })
  txn_m5_buys: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_m5_sells: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h1_buys: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h1_sells: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h6_buys: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h6_sells: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h24_buys: number;

  @Column({ nullable: true, type: 'bigint' })
  txn_h24_sells: number;

  // Price change fields
  @Column({ nullable: true, type: 'float' })
  price_change_m5: number;

  @Column({ nullable: true, type: 'float' })
  price_change_h1: number;

  @Column({ nullable: true, type: 'float' })
  price_change_h6: number;

  @Column({ nullable: true, type: 'float' })
  price_change_h24: number;

  // Volume fields
  @Column({ nullable: true, type: 'float' })
  volume_m5: number;

  @Column({ nullable: true, type: 'float' })
  volume_h1: number;

  @Column({ nullable: true, type: 'float' })
  volume_h6: number;

  @Column({ nullable: true, type: 'float' })
  volume_h24: number;

  // Liquidity fields
  @Column({ nullable: true, type: 'float' })
  liquidity_usd: number;

  @Column({ nullable: true, type: 'float' })
  liquidity_base: number;

  @Column({ nullable: true, type: 'float' })
  liquidity_quote: number;

  @Column({ nullable: true })
  info_image_url: string;

  @Column({ nullable: true })
  info_header: string;

  @Column({ nullable: true })
  info_open_graph: string;

  @Column({ type: 'json', nullable: true })
  info_websites: Website[];

  @Column({ type: 'json', nullable: true })
  info_socials: Social[];

  @Column({ nullable: true })
  holder_count: number;

  @Column({ nullable: true })
  twitter_description: string;

  @Column({ type: 'json', nullable: true })
  holders: Array<{
    amount: number;
    owner: string;
    percentage: number;
  }>;

  @Column({ type: 'json', nullable: true })
  recent_tweets: Array<{
    created_at: string;
    username: string;
    content: string;
  }>;

  @Column({ nullable: true, type: 'timestamptz' })
  last_updated_at: Date;

  @Column({ nullable: true, type: 'simple-json' })
  error_message_dexscreener: string;

  @Column({ nullable: true, type: 'simple-json' })
  error_message_birdeye: string;

  @Column({ type: 'json', nullable: true })
  error_message_twitter: string;
}
