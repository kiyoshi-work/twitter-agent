export interface TwitterSearchResponse {
  data: {
    search: {
      timeline_response: {
        timeline: {
          instructions: Array<{
            __typename: string;
            entries: TwitterEntry[];
          }>;
        };
      };
    };
  };
}

export interface TwitterEntry {
  content: {
    __typename: string;
    content?: {
      __typename: string;
      tweetResult?: {
        result: {
          legacy: TweetLegacy;
          rest_id: string;
          quoted_status_result?: any;
          note_tweet?: {
            note_tweet_results: {
              result: {
                text: string;
              };
            };
          };
          view_count_info?: {
            count: string;
          };
          core: {
            user_result: {
              result: {
                legacy: {
                  name: string;
                };
              };
            };
          };
        };
      };
    };
    cursorType?: string;
    value?: string;
  };
  entryId: string;
  sortIndex: string;
}

export interface TweetLegacy {
  created_at: string;
  full_text: string;
  favorite_count: number;
  reply_count: number;
  retweet_count: number;
  conversation_id_str: string;
  in_reply_to_status_id_str?: string;
  retweeted_status_result?: any;
  extended_entities?: {
    media: Array<{
      media_url_https: string;
      original_info: any;
      type: string;
    }>;
  };
}

export interface TwitterSearchParams {
  query: string;
  cursor?: string;
}
