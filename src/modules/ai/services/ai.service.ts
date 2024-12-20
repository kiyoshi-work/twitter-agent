import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TChatModel, TChatModelName } from '@/shared/interfaces';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { GetTwitterInfoTool } from '../tools/get-twitter-info.tool';
import {
  AdminConfigRepository,
  TwitterPostRepository,
} from '@/database/repositories';
import { ChatOpenAI } from '@langchain/openai';
import { truncateToCompleteSentence } from '@/shared/helper';
import { RapidTwitterService } from '@/crawler/services/rapid-twitter.service';
import { GetTokenInfoTool } from '../tools/get-token-info.tool';
import { TweetService } from '@/business/services/tweet.service';
import { AgentService } from './agent.service';
import { SkipTool } from '../tools/skip.tool';
import { GetMyProjectTool } from '../tools/get-my-project.tool';
import {
  fetchTwitterNewsTitles,
  TwitterMetrics,
} from '@/shared/api/news-treeofalpha';
import { NoResponseTool } from '../tools/no-response.tool';
import { KnowledgeRagTool } from '../tools/knowledge-rag.tool';

@Injectable()
export class AiService {
  @Inject('CHAT_OPENAI')
  public chatOpenAi: TChatModel;
  @Inject(GetTwitterInfoTool)
  readonly getTwitterInfoTool: GetTwitterInfoTool;

  @Inject(GetTokenInfoTool)
  readonly getTokenInfoTool: GetTokenInfoTool;

  @Inject(SkipTool)
  readonly skipTool: SkipTool;

  @Inject(GetMyProjectTool)
  readonly getMyProjectTool: GetMyProjectTool;

  @Inject(NoResponseTool)
  readonly noResponseTool: NoResponseTool;

  @Inject(KnowledgeRagTool)
  private readonly knowledgeRagTool: KnowledgeRagTool;

  @Inject(TweetService)
  private readonly tweetService: TweetService;

  private llm: ChatOpenAI;

  handlerTools(metadata?: any) {
    return [this.getTwitterInfoTool.clone()];
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly adminConfigRepository: AdminConfigRepository,
    private readonly twitterPostRepository: TwitterPostRepository,
    private readonly rapidTwitterService: RapidTwitterService,
  ) {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
      openAIApiKey: this.configService.get<string>('ai.open_ai_key'),
    });
  }

  async extractSymbolFromTweet(tweet: any) {
    try {
      const prompt: any = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `
  You are an expert cryptocurrency analyst specializing in meme token trading and analyzing Key Opinion Leader (KOL) tweets from Twitter. Your task is to analyze tweets and identify:
  You could get token from quote and retweet of the tweet if have token
  
  1. Meme cryptocurrency tokens.
  2. Relevant cryptocurrency topics being discussed
  
  
  Analysis Parameters:
  - Meme Tokens: Identify any meme token symbols (meme token could be any type of character)
  - Insights: Identify any insights or opinions about the meme token or blockchain topics
  - Evidence: Provide specific references from the tweet content
  
  Note: Only one or more 'token' to be filled - use the most relevant based on the tweet content. When tweets contain '$' before a symbol, it likely indicates a token reference.
  
  Response Format is always an array of object each object contain a token symbol you found:
      "token": string,   // Meme token symbol if found
      "insights": string,   // Insights or opinions about the meme token or blockchain topics
      "reason": string   // Detailed explanation with specific tweet references
      "related_score": float   // Confidence score between 0 and 1 with 1 when the tweet is the more likely it is to mention that token
      "positive_score": float   // Sentiment of the tweet 0 to 1 with 1 being most positive, positive bigger when the tweet shill and make user want to buy the token
  
  Example an object Response (Relevant Content):
      "token": "PEPE",
      "insights": "",
      "reason": "Tweet mentions @PEPE token discussing its liquidity and trading volume metrics",
      "related_score": 0.95,
      "positive_score": 0.8

  Example an object Response (Negative Sentiment):
      "token": "PEPE",
      "insights": "",
      "reason": "Tweet mentions @PEPE is a scam",
      "related_score": 0.7,
      "positive_score": 0.3
      `,
        ),
        HumanMessagePromptTemplate.fromTemplate('{input}'),
      ]);
      // const input = `Tweet: ${JSON.stringify(tweet)}`;
      let input = `Tweet: ${tweet?.content} posted at ${tweet?.post_created} by user ${JSON.stringify({ username: tweet?.twitter_user?.username, follower_count: tweet?.twitter_user?.follower_count, following_count: tweet?.twitter_user?.following_count })}
      and had ${tweet?.favorite_count} likes, ${tweet?.reply_count} replies, ${tweet?.retweet_count} retweets, ${tweet?.views} views
        `;
      if (tweet?.related?.quote) {
        input += `\nThis tweet quoted:
          ${JSON.stringify({ content: tweet?.related?.quote?.content, post_created: tweet?.related?.quote?.post_created, favorite_count: tweet?.related?.quote?.favorite_count })} of user
          ${JSON.stringify({ username: tweet?.related?.quote?.author?.username, followers_count: tweet?.related?.quote?.author?.followers_count, bio: tweet?.related?.quote?.author?.bio })}`;
      }
      if (tweet?.related?.retweet) {
        input += `\nThis tweet retweeted:
          ${JSON.stringify({ content: tweet?.related?.retweet?.content, post_created: tweet?.related?.retweet?.post_created, favorite_count: tweet?.related?.retweet?.favorite_count })} of user
          ${JSON.stringify({ username: tweet?.related?.retweet?.author?.username, followers_count: tweet?.related?.retweet?.author?.followers_count, bio: tweet?.related?.retweet?.author?.bio })}`;
      }
      // console.log(input, 'input');
      const executionResult = await prompt
        .pipe(this.chatOpenAi['gpt-4o-mini'])
        .invoke({ input });
      return JSON.parse(
        executionResult?.content?.replace(/^```json|```$/g, ''),
      )?.filter((dt) => dt?.token?.length);
      // console.log(JSON.parse(executionResult?.content));
    } catch (error) {
      console.log('extractSymbolFromTweet', error);
      return null;
    }
  }

  protected getGrokKey(): string {
    const getGrokKeys = this.configService
      .get<string>('ai.grok_keys')
      ?.split(',');
    return getGrokKeys[Math.floor(Math.random() * getGrokKeys.length)];
  }

  protected getOpenAIKey(): string {
    const openAiKeys = this.configService
      .get<string>('ai.open_ai_key')
      ?.split(',');
    return openAiKeys[Math.floor(Math.random() * openAiKeys.length)];
  }

  getChatModel(chatModel: TChatModelName) {
    switch (chatModel) {
      case 'grok-beta':
        return new ChatOpenAI({
          openAIApiKey: this.getOpenAIKey(),
          modelName: 'grok-beta',
          temperature: 0.7,
          configuration: {
            baseURL: 'https://api.x.ai/v1',
            apiKey: this.getGrokKey(),
          },
        });
      default:
        return new ChatOpenAI({
          openAIApiKey: this.getOpenAIKey(),
          modelName: chatModel,
          temperature: 0.7,
        });
    }
  }

  async generateReplyTweet(data: {
    question: string;
    conversationId?: string;
    modelName: TChatModelName;
  }): Promise<string> {
    const { question, modelName } = data;
    const tools = this.handlerTools();
    // const llm = this.chatOpenAi[modelName];
    const llm = new ChatOpenAI({
      openAIApiKey: this.configService.get<string>('ai.open_ai_key'),
      modelName: 'grok-beta',
      temperature: 0.7,
      configuration: {
        baseURL: 'https://api.x.ai/v1',
        apiKey: this.getGrokKey(),
      },
    });
    const cookies = await this.adminConfigRepository.findOneByKey(
      'twitter-client-cookies',
    );

    const promptText = await this.adminConfigRepository.findOneByKey('prompt');
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', promptText?.value],
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt: prompt as any,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });
    let conversations = [];
    if (data?.conversationId) {
      conversations = await this.twitterPostRepository.find({
        where: {
          conversation_id: data?.conversationId,
        },
        take: 6,
        order: {
          timestamp: 'DESC',
        },
        select: ['text', 'username', 'reply_content'],
      });
    }
    const executionResult = await agentExecutor.invoke({
      input: question.replace(`@${cookies?.data?.username || ''}`, ''),
    });
    console.log(
      '🚀 ~ AiService ~ aiMessage:',
      JSON.stringify(executionResult?.output),
    );
    return truncateToCompleteSentence(executionResult?.output);
    // STREAM: https://js.langchain.com/docs/modules/agents/how_to/streaming
    // const eventStream = agentExecutor.streamEvents(
    //   {
    //     input: question,
    //   },
    //   { version: 'v1' },
    // );
    // let aiMessage = '';

    // for await (const event of eventStream) {
    //   const eventType = event.event;
    //   if (eventType === 'on_chain_start') {
    //     // Was assigned when creating the agent with `.withConfig({"runName": "Agent"})` above
    //     if (event.name === 'Agent') {
    //       console.log('\n-----');
    //       console.log(
    //         `Starting agent: ${event.name} with input: ${JSON.stringify(
    //           event.data.input,
    //         )}`,
    //       );
    //     }
    //   } else if (eventType === 'on_chain_end') {
    //     // Was assigned when creating the agent with `.withConfig({"runName": "Agent"})` above
    //     if (event.name === 'Agent') {
    //       console.log('\n-----');
    //       console.log(`Finished agent: ${event.name}\n`);
    //       console.log(`Agent output was: ${event.data.output}`);
    //       console.log('\n-----');
    //     }
    //   } else if (eventType === 'on_llm_stream') {
    //     const content = event.data?.chunk?.message?.content;
    //     // Empty content in the context of OpenAI means
    //     // that the model is asking for a tool to be invoked via function call.
    //     // So we only print non-empty content
    //     if (content !== undefined && content !== '') {
    //       response(`| ${content}`);
    //       aiMessage += content;
    //     }
    //   } else if (eventType === 'on_tool_start') {
    //     console.log('\n-----');
    //     console.log(
    //       `Starting tool: ${event.name} with inputs: ${event.data.input}`,
    //     );
    //   } else if (eventType === 'on_tool_end') {
    //     console.log('\n-----');
    //     console.log(`Finished tool: ${event.name}\n`);
    //     console.log(`Tool output was: ${event.data.output}`);
    //     console.log('\n-----');
    //   }
    // }
    // console.log('🚀 ~ AiService ~ forawait ~ aiMessage:', aiMessage);
  }

  async checkIsQuestion(
    username: string,
    userRequest: string,
    history: Array<{ username: string; text: string; reply_content: string }>,
  ) {
    let prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Your name is {username}. ' +
          'You are an assistant help other assistant to verify user request and conversation is a question or a request or not' +
          'WH question word always a question, you need continue conversation.' +
          'Return true if you need continue conversation.' +
          'REMEMBER: RESPONSE ALWAYS TRUE OR FALSE',
      ],
      ['user', ' User request: {user_request}'],
    ]);

    const thread =
      history && history.length > 0
        ? history
            .map(
              (t: any) =>
                `- @${t.username}: ${t.text}${
                  t.reply_content ? `\n- You: ${t.reply_content}` : ''
                }`,
            )
            .join('\n')
        : '';

    prompt = await prompt.partial({
      user_request: userRequest,
      username,
    });
    const chain = prompt.pipe(this.llm as any);
    const result: any = await chain.invoke({});
    const content = result.content as string;

    return {
      result: ['true', 'TRUE', 'True'].includes(content),
      thread,
      content,
    };
  }

  async generateReplyTweetv3(data: {
    question: string;
    conversationId?: string;
    prompt_first?: string;
    prompt_second?: string;
    model_first?: TChatModelName;
    model_second?: TChatModelName;
  }): Promise<any> {
    const { question, model_first, model_second, prompt_first, prompt_second } =
      data;
    const tools = [
      this.getTwitterInfoTool.clone(),
      this.getTokenInfoTool.clone(),
      this.skipTool.clone(),
      this.getMyProjectTool.clone(),
      this.knowledgeRagTool.clone(),
      // this.noResponseTool.clone(),
    ];
    const promptText =
      await this.adminConfigRepository.findOneByKey('prompt-v3');
    console.log(promptText?.data, '--- PROMPT ---');
    const modelFirst = this.getChatModel(
      model_first ? model_first : promptText?.data?.modelFirst || 'gpt-4o-mini',
    );
    const modelSecond = this.getChatModel(
      model_second
        ? model_second
        : promptText?.data?.modelSecond || 'grok-beta',
    );
    const cookies = await this.adminConfigRepository.findOneByKey(
      'twitter-client-cookies',
    );

    // let conversations = [];
    // if (data?.conversationId) {
    //   conversations = await this.twitterPostRepository.find({
    //     where: {
    //       conversation_id: data?.conversationId,
    //     },
    //     take: 6,
    //     order: {
    //       timestamp: 'DESC',
    //     },
    //     select: ['text', 'username', 'reply_content'],
    //   });
    // }
    const agentService = new AgentService(
      modelFirst,
      modelSecond,
      prompt_first ? prompt_first : promptText?.data?.promptFirst,
      prompt_second ? prompt_second : promptText?.data?.promptSecond,
    );
    await agentService.initialize({ tools: tools });
    const output = await agentService.invoke(
      question.replace(`@${cookies?.data?.username || ''}`, ''),
      [],
    );
    if (output?.status == 500) {
      return output;
    } else {
      console.log('=== ANSWER:', output?.content);
      return output?.content;
    }
  }

  async generateNewV2() {
    const rs = await fetchTwitterNewsTitles();

    const {
      result: question,
      text,
      formattedPrompt,
    } = await this.generateQuestion(
      'What is the latest news about Bitcoin?',
      rs,
    );

    const { result: answer, formattedPrompt: formattedPromptAnswer } =
      await this.generateAnswer(question, text);

    return {
      question,
      answer,
      formattedPrompt,
      formattedPromptAnswer,
    };
  }

  private async generateQuestion(
    question: string,
    twitterPosts: TwitterMetrics[],
  ) {
    const llm = this.getChatModel('grok-beta');

    const promptText =
      await this.adminConfigRepository.findOneByKey('generate-new');

    let prompt = ChatPromptTemplate.fromMessages([
      ['system', promptText?.data?.prompt_question],
      ['user', 'Twitter posts: {text}.'],
    ]);

    const formatText = JSON.stringify(twitterPosts);

    prompt = await prompt.partial({
      text: formatText,
    });

    const formattedPrompt = await prompt.format({
      text: formatText,
    });

    const chain = prompt.pipe(llm as any);
    const result: any = await chain.invoke({});
    const content = result.content as string;

    return { result: content, formattedPrompt, text: formatText };
  }

  private async generateAnswer(question: string, text: string) {
    const llm = this.getChatModel('grok-beta');
    const promptText =
      await this.adminConfigRepository.findOneByKey('generate-new');

    let prompt = ChatPromptTemplate.fromMessages([
      ['system', promptText?.data?.prompt_answer],
      [
        'user',
        `Hey, answer the users question based on twitter posts:

The users question: {question}

The twitter posts: {context}]`,
      ],
    ]);

    prompt = await prompt.partial({
      question,
      context: text,
    });

    const formattedPrompt = await prompt.format({
      question,
      context: text,
    });

    const chain = prompt.pipe(llm as any);
    const result: any = await chain.invoke({});
    const content = result.content as string;

    return { result: content, formattedPrompt };
  }
}
