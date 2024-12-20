import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { BaseTool } from './base.tool';
import { AdminConfigRepository } from '@/database/repositories';

@Injectable()
export class GetMyProjectTool extends BaseTool {
  constructor(private readonly adminConfigRepository: AdminConfigRepository) {
    super();
  }
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'get_my_project_tool';
  description = `Get information/document/roadmap about my project (taro_ai)/ my token ($taro)`;

  nameToken = '';

  schema = z.object({}) as any;

  async _call() {
    const project = await this.adminConfigRepository.findOne({
      where: {
        key: 'my-project',
      },
    });
    return JSON.stringify({ status: 200, data: project?.value });
  }
}
