# Crypto Twitter Bot

## Overview

The Crypto Twitter Bot is an automated application designed to collect and analyze tweets from key opinion leaders (KOLs) in the cryptocurrency space. This bot not only tracks the most frequently mentioned tokens but also automatically responds to tagged questions and generates new content for Twitter.

You can find and interact with the bot here: [@0x_Doflamingo](https://x.com/0x_Doflamingo).

## Features

1. **Real-time Tweet Collection**: The bot listens to and collects tweets from KOLs in the crypto space, analyzing keywords to identify the most shilled tokens.
   - **Relevant Code**: `src/modules/crawler/services/rapid-twitter.service.ts` and `src/modules/business/services/tweet.service.ts`.

2. **Automated Responses**: The bot can automatically reply to questions when tagged on Twitter using an AI agent. This feature utilizes a function calling mechanism along with a Retrieval-Augmented Generation (RAG) pipeline to enhance the quality of responses.
   - **Function Calling**: The bot can invoke specific functions based on the context of the question, allowing it to fetch relevant data or perform actions dynamically. This is implemented in the `src/modules/ai/services/agent.service.ts` and `src/modules/ai/tools/get-twitter-info.tool.ts`.
   - **RAG Pipeline**: The RAG pipeline combines retrieval of relevant information from a knowledge base with generative capabilities of AI models. This allows the bot to provide contextually accurate and informative responses by first retrieving pertinent data and then generating a coherent reply. The implementation can be found in `src/modules/ai/tools/knowledge-rag.tool.ts`.

3. **Content Generation**: The bot can automatically create new tweets, including images, from aggregated sources on Twitter.

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- NestJS
- PostgreSQL (or compatible database)
- **pgvector**: Ensure you have pgvector installed for vector storage in PostgreSQL.
- **Langchain**: To visualize the agent, set the following environment variables:
  ```env
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
  LANGCHAIN_API_KEY=lsv2_pt_...
  LANGCHAIN_PROJECT=""
  ```

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/crypto-twitter-bot.git
cd crypto-twitter-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

1. **Copy the Sample Environment File**: To set up your environment variables, copy the sample environment file to create your own `.env` file.

   ```bash
   cp env.sample .env
   ```

2. **Edit the `.env` File**: Open the `.env` file in your preferred text editor and add the necessary environment variables:

   ```env
    RAPID_KEY=
    OPEN_AI_API_KEY=
    BIRDEYE_API_KEY=
    COINGECKO_API_KEY=
    GROK_KEYS=
   ```

### Step 4: Start the Application

```bash
npm run start:dev
```


### Step 5: Database Migration

To set up the materialized view for tracking token popularity, execute the following SQL commands in your PostgreSQL database.

#### Create Materialized View

```sql
-- CREATE MATERIALIZED VIEW 
DROP MATERIALIZED VIEW IF EXISTS token_popular;

CREATE MATERIALIZED VIEW token_popular AS
WITH normalized_data AS (
    SELECT
        symbol,
        tweet_id,
        username,
        related_score,
        positive_score,
        favorite_count,
        reply_count,
        retweet_count,
        post_created,
        
        -- Normalization factors: related_score, positive_score, favorite_count
        (favorite_count - MIN(favorite_count) OVER()) / NULLIF(MAX(favorite_count) OVER() - MIN(favorite_count) OVER(), 0) AS normalized_favorite_count,
        (reply_count - MIN(reply_count) OVER()) / NULLIF(MAX(reply_count) OVER() - MIN(reply_count) OVER(), 0) AS normalized_reply_count,
        (retweet_count - MIN(retweet_count) OVER()) / NULLIF(MAX(retweet_count) OVER() - MIN(retweet_count) OVER(), 0) AS normalized_retweet_count,

        -- Calculate days since post
        EXTRACT(EPOCH FROM (NOW() - post_created)) / 86400 AS days_since_post,
        -- Recency weight
        EXP(-0.05 * EXTRACT(EPOCH FROM (NOW() - post_created)) / 86400) AS recency_weight
    FROM shilled_tokens
),
popularity_scores AS (
    SELECT
        *,
        0.2 * normalized_favorite_count +
        0.2 * normalized_reply_count + 
        0.2 * normalized_retweet_count + 
        0.4 * recency_weight 
        AS impact_score
    FROM normalized_data
)
-- Select statement to aggregate data
SELECT
    symbol,
    SUM(impact_score * related_score * POWER(positive_score, 0.5))/ SUM(impact_score) AS avg_popularity_score,
    SUM(favorite_count) AS total_favorite_count,
    SUM(reply_count) AS total_reply_count,
    SUM(retweet_count) AS total_retweet_count,
    array_agg(distinct(tweet_id)) AS tweet_ids,
    array_agg(distinct(username)) AS usernames,
    TO_TIMESTAMP(AVG(EXTRACT(EPOCH FROM post_created))::bigint)  AS avg_post_created,
    CAST(COUNT(*) as int ) as post_count
FROM popularity_scores
GROUP BY symbol
ORDER BY avg_popularity_score DESC;
```

#### Create Trigger for Refreshing the Materialized View

```sql
-- TRIGGER REFRESH MATERIALIZED VIEW
CREATE OR REPLACE FUNCTION refresh_materialized_view()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh Materialized View
    REFRESH MATERIALIZED VIEW token_popular;
    RETURN NULL; -- No need to return data
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_view_trigger
AFTER INSERT OR UPDATE OR DELETE
ON shilled_tokens
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_materialized_view();
```

### Explanation

1. **Materialized View Creation**: The SQL commands create a materialized view named `token_popular` that aggregates data from the `shilled_tokens` table, calculating various scores and counts.
2. **Refresh Function**: A function `refresh_materialized_view` is defined to refresh the materialized view whenever there are changes in the `shilled_tokens` table.
3. **Trigger**: A trigger `refresh_view_trigger` is set to call the refresh function after any insert, update, or delete operation on the `shilled_tokens` table.

Make sure to execute these commands in your PostgreSQL database to ensure the bot functions correctly with the latest data.

## Usage

### Collecting Tweets

The bot will automatically collect tweets from configured KOLs in the code. You can customize these KOLs.

### Automated Responses

When a tweet is tagged, the bot will use the AI agent to analyze and respond automatically. The function calling mechanism allows the bot to dynamically invoke specific functions based on the user's query, ensuring that the responses are not only relevant but also actionable. The RAG pipeline enhances this process by retrieving relevant information from a knowledge base before generating a response, leading to more accurate and context-aware replies.

You can customize the questions and responses in the code, as well as the functions that can be called based on the context of the conversation.

### Content Generation

The bot will automatically generate new content based on collected tweets. You can configure the frequency and content of tweets.

## Contributing

If you would like to contribute to this project, please create a pull request or open an issue to discuss changes.

## License

This project is licensed under the [MIT License](LICENSE).
