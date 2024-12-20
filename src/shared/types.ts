export type TJWTPayload = {
  sub: string;
  // address: string;
};

export type TTwitterUserMetadata = {
  description: string;
  image_url: string;
  banner_url: string;
  url?: string;
};

export type TTwitterUserInfo = {
  rest_id: string;
  username: string;
  is_blue_verified?: boolean;
  follower_count: number;
  following_count: number;
  name?: string;
  metadata?: TTwitterUserMetadata;
};

export type TTweet = {
  tweet_id: string;
  post_type?: string;
  content: string;
  post_created: Date;
  post_sentiment: number;
  interactions_24h: number;
  interactions_total: number;
};
