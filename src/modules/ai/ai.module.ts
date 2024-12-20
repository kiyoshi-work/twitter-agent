import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/database';
import { configAI } from './configs/ai';
import { AiService } from './services/ai.service';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { TChatModel, TTextEmbedding } from '@/shared/interfaces';
import { GetTwitterInfoTool } from './tools/get-twitter-info.tool';
import { CrawlerModule } from '@/crawler/crawler.module';
import { GetTokenInfoTool } from './tools/get-token-info.tool';
import { BusinessModule } from '@/business/business.module';
import { SkipTool } from './tools/skip.tool';
import { GetMyProjectTool } from './tools/get-my-project.tool';
import { RedisCacheModule } from '@/redis-cache/redis-cache.module';
import { NoResponseTool } from './tools/no-response.tool';
import { KnowledgeRagTool } from './tools/knowledge-rag.tool';
import { PGVectorModule } from '@/pgvector-db/pgvector.module';

const tools = [
  GetTwitterInfoTool,
  GetTokenInfoTool,
  SkipTool,
  GetMyProjectTool,
  NoResponseTool,
  KnowledgeRagTool,
];
@Module({
  imports: [
    DatabaseModule,
    CrawlerModule,
    BusinessModule,
    PGVectorModule,
    RedisCacheModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configAI],
    }),
  ],
  controllers: [],
  // @ts-ignore
  providers: [
    AiService,
    ...tools,
    {
      provide: 'CHAT_OPENAI',
      useFactory: async (config: ConfigService) => {
        const openAIApiKey = config.get<string>('ai.open_ai_key');
        const chatModels: TChatModel = {
          'gpt-3.5-turbo': new ChatOpenAI({
            openAIApiKey,
            modelName: 'gpt-3.5-turbo',
            temperature: 0.7,
          }),
          'gpt-4': new ChatOpenAI({
            openAIApiKey,
            modelName: 'gpt-4',
            temperature: 0.7,
          }),
          'gpt-4-turbo': new ChatOpenAI({
            openAIApiKey,
            modelName: 'gpt-4-turbo',
            temperature: 0.7,
          }),
          'gpt-4o': new ChatOpenAI({
            openAIApiKey,
            modelName: 'gpt-4o',
            temperature: 0.7,
          }),
          'gpt-4o-mini': new ChatOpenAI({
            openAIApiKey,
            modelName: 'gpt-4o-mini',
            temperature: 0.7,
          }),
          'grok-beta': new ChatOpenAI({
            openAIApiKey,
            modelName: 'grok-beta',
            temperature: 0.7,
            configuration: {
              baseURL: 'https://api.x.ai/v1',
              apiKey:
                'xai-iRPzygsiqAFJTZYlTtmX6itGhKVP4aYnCtgRbmO3dIP1Jimtkd7j7ZwCl0ErsQLugTgt9umSRNoWgUCR',
            },
          }),
        };
        return chatModels;
      },
      inject: [ConfigService],
    },
    {
      provide: 'TEXT_EMBEDDING',
      useFactory: async (config: ConfigService) => {
        const openAIApiKey = config.get<string>('ai.open_ai_key');
        const textEmbeddings: TTextEmbedding = {
          'text-embedding-3-small': new OpenAIEmbeddings({
            openAIApiKey,
            modelName: 'text-embedding-3-small',
          }),
          'text-embedding-3-large': new OpenAIEmbeddings({
            openAIApiKey,
            modelName: 'text-embedding-3-large',
          }),
        };
        return textEmbeddings;
      },
      inject: [ConfigService],
    },
  ],
  exports: [AiService, 'TEXT_EMBEDDING', 'CHAT_OPENAI', ...tools],
})
export class AiModule implements OnApplicationBootstrap {
  constructor(private aiService: AiService) {}

  async onApplicationBootstrap() {
    // const res = await this.aiService.extractSymbolFromTweet(tweet);
    // console.log(res, 'res');
    // const res = await this.aiService.generateReplyTweetv3({
    //   question: `what do elon musk talk about $BONK, give me info of this token ?`,
    //   // question: `How the weather today`,
    //   // question: `What is your roadmap`,
    //   // question: `What do @elonmusk think about my project ?`,
    //   // question: `How about THENA sentiment`,
    //   // question: `Get price of $btc now`,
    //   // question: `What is new trend of crypto`,
    //   // question: `what token elon musk call last year, give me info of $BONK`,
    // });
    // console.log(res, 'res');
  }
}
