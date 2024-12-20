import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { BaseTool } from './base.tool';

@Injectable()
export class SkipTool extends BaseTool {
  constructor() {
    super();
  }
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'skip_tool';
  description = `Use when others tools not call`;

  nameToken = '';

  schema = z.object({}) as any;

  async _call() {
    return JSON.stringify({ status: 200, data: {} });
  }
}
