export interface TwitterUserProfile {
  advertiser_account_service_levels: string[];
  advertiser_account_type: string;
  analytics_type: string;
  can_dm: boolean;
  can_media_tag: boolean;
  created_at: string;
  description: string;
  entities: {
    description: {
      hashtags: any[];
      symbols: any[];
      urls: any[];
      user_mentions: any[];
    };
  };
  fast_followers_count: number;
  favourites_count: number;
  followers_count: number;
  following: boolean;
  friends_count: number;
  geo_enabled: boolean;
  has_custom_timelines: boolean;
  has_extended_profile: boolean;
  id_str: string;
  is_translator: boolean;
  location: string;
  media_count: number;
  name: string;
  normal_followers_count: number;
  pinned_tweet_ids_str: string[];
  profile_background_color: string;
  profile_banner_url: string;
  profile_image_url_https: string;
  profile_interstitial_type: string;
  profile_link_color: string;
  protected: boolean;
  screen_name: string;
  statuses_count: number;
  translator_type_enum: string;
  verified: boolean;
  want_retweets: boolean;
  withheld_in_countries: string[];
}
