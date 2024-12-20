import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { BaseTool } from './base.tool';
import { DocumentRepository } from '@/pgvector-db/repositories/document.repository';

@Injectable()
export class KnowledgeRagTool extends BaseTool {
  constructor(private readonly documentRepository: DocumentRepository) {
    super();
  }
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'knowledge_rag_tool';
  description = `Use when need to fetch crypto market information trend`;

  nameToken = '';

  schema = z.object({
    question: z.string().describe('This is question user want to ask'),
  }) as any;

  async _call(input: { question: string }) {
    const data = await this.documentRepository.queryOrmVector(
      input?.question,
      10,
    );
    return JSON.stringify({
      status: 200,
      data: data.slice(0, 10).map((dt) => {
        delete dt.id;
        delete dt.post_id;
        delete dt.post_source;
        delete dt.distance;
        return dt;
      }),
    });
  }
}
