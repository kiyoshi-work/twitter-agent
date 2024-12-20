import axios from 'axios';

export interface TwitterInfo {
  twitterId: string;
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
  isSelfReply: boolean;
}

export interface NewsItem {
  _id: string;
  source: string;
  title: string;
  url: string;
  icon: string;
  image: string;
  time: number;
  info: TwitterInfo;
  suggestions: any[]; // or define a more specific type if needed
}

export async function getNews(): Promise<Array<NewsItem>> {
  const response = await axios.get<Array<NewsItem[]>>(
    'https://news.treeofalpha.com/api/news',
    {
      params: {
        limit: 500,
      },
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://news.treeofalpha.com/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    },
  );

  return response.data.flat();
}

export async function getTwitterNews() {
  const rs = await getNews();
  return rs.filter((item) => item.source === 'Twitter');
}

const fetchTweetMetrics = async (tweetId) => {
  const url = `https://twttrapi.p.rapidapi.com/get-tweet?tweet_id=${tweetId}`;
  const headers = {
    'x-rapidapi-host': 'twttrapi.p.rapidapi.com',
    'x-rapidapi-key': process.env.RAPID_KEY,
  };

  try {
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const metrics = data?.data?.tweet_result?.result?.legacy || {};
    const {
      quote_count,
      reply_count,
      retweet_count,
      favorite_count,
      created_at: post_created,
    } = metrics;

    // Get the rest_id from the user data
    const rest_id =
      data?.data?.tweet_result?.result?.core?.user_result?.result?.rest_id ||
      null;

    return {
      quote_count,
      reply_count,
      retweet_count,
      favorite_count,
      rest_id,
      post_created: post_created ? new Date(post_created) : null,
    };
  } catch (error) {
    console.error(
      `Error fetching tweet metrics for tweet ID ${tweetId}:`,
      error,
    );
    return {
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 0,
      rest_id: null,
    }; // Default values in case of error
  }
};

export interface TwitterMetrics {
  title: string;
  quote_count: number;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  rest_id: string;
  post_created: Date;
  tags: string[];
}

export const fetchTwitterNewsTitles = async (
  take: number = 100,
  isDetail: boolean = false,
): Promise<TwitterMetrics[]> => {
  try {
    const response = await fetch(
      'https://news.treeofalpha.com/api/news?limit=' + take,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    // Filter for news from source "Twitter"
    const twitterNews = data.filter((item) => item.source === 'Twitter');

    // Chunk array into groups of 5
    const chunkArray = (array, size) => {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    };

    const chunks = chunkArray(twitterNews, 5);

    const newsWithMetrics = [];
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          const tweetId = item._id;
          const metrics = await fetchTweetMetrics(tweetId);

          // Filter by rest_id
          // if (metrics.rest_id != '44196397') {
          return {
            title: item.title,
            quote_count: metrics.quote_count,
            reply_count: metrics.reply_count,
            retweet_count: metrics.retweet_count,
            favorite_count: metrics.favorite_count,
            ...(isDetail && {
              rest_id: item._id,
              post_created: metrics.post_created,
              tags: item?.suggestions
                ?.map((sg) => sg?.found)
                ?.flat()
                ?.map((tag) => tag?.toLowerCase()),
            }),
          };
          // }
          // return null;
        }),
      );
      // Filter out null results
      newsWithMetrics.push(...chunkResults.filter((item) => item !== null));
    }

    // Sort by retweet_count in descending order
    newsWithMetrics.sort((a, b) => b.retweet_count - a.retweet_count);

    return newsWithMetrics;
  } catch (error) {
    console.error('Error fetching or processing data:', error);
    return [];
  }
};

// // Example usage
// fetchTwitterNewsTitles().then((news) => {
//   console.log('Twitter News with Metrics (Filtered and Sorted):', news);
// });
