import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { BaseTool } from './base.tool';

@Injectable()
export class NoResponseTool extends BaseTool {
  constructor() {
    super();
  }
  public clone(config?: any): this {
    return super.clone(config);
  }

  name = 'no_response';
  description = `Used when a user wants to find out the token that an user has shilled. Twitter username just only detect by string start with @.
Example: "What did @Ansem shill in 2024?" then Twitter username is Ansem
Example: "What did elonmusk shill in 2024?" then Twitter username is NOT FOUND
  `;

  schema = z.object({
    username: z
      .string()
      .describe('This is twitter username. Example: @elonmusk'),
  }) as any;

  nameToken = '';

  async _call(input: any) {
    return JSON.stringify({
      data: input.username.includes('@') ? input : null,
      status: 500,
    });
  }
}
