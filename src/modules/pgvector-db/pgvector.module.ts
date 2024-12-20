import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/database';
import { configLangchain } from './configs/langchain';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entities/document.entity';
import { DocumentRepository } from './repositories/document.repository';
import { OpenAIEmbeddings } from '@langchain/openai';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forRootAsync({
      name: 'vector',
      useFactory: (config: ConfigService) => config.get('langchain.db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([DocumentEntity], 'vector'),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configLangchain],
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: 'TEXT_EMBEDDING_3_LARGE',
      useFactory: async (config: ConfigService) => {
        try {
          return new OpenAIEmbeddings({
            modelName: 'text-embedding-3-large',
            openAIApiKey: config.get<string>('langchain.open_ai_key'),
          });
        } catch (e) {
          console.log('TEXT_EMBEDDING_3_LARGE');
          console.error(e);
          throw e;
        }
      },
      inject: [ConfigService],
    },
    DocumentRepository,
  ],
  exports: [DocumentRepository, 'TEXT_EMBEDDING_3_LARGE'],
})
export class PGVectorModule implements OnApplicationBootstrap {
  constructor(
    @Inject('TEXT_EMBEDDING_3_LARGE')
    public embeddingModel: OpenAIEmbeddings,
  ) {}

  async onApplicationBootstrap() {}
}
