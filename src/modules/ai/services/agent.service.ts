import { ChatOpenAI } from '@langchain/openai';
import { Runnable, RunnableSequence } from '@langchain/core/runnables';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { JsonOutputToolsParser } from 'langchain/output_parsers';
import { BaseTool } from '../tools/base.tool';
export interface IOption {
  tools: BaseTool[];
  name?: string;
}

export class AgentService {
  firstLlm: ChatOpenAI;
  secondLlm: ChatOpenAI;
  firstPrompt: string;
  secondPrompt: string;
  chainFirstLLM: Runnable;
  chainSecondLLM: Runnable;
  tools: BaseTool[];

  constructor(
    firstLlm: ChatOpenAI,
    secondLlm: ChatOpenAI,
    firstPrompt: any,
    secondPrompt: any,
  ) {
    this.firstLlm = firstLlm;
    this.secondLlm = secondLlm;
    this.firstPrompt = firstPrompt;
    this.secondPrompt = secondPrompt;
  }

  initialize = async (options: IOption) => {
    const firstPromptTemplate = ChatPromptTemplate.fromMessages([
      ['system', this.firstPrompt],
      new MessagesPlaceholder('messages'),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
    ]);

    const secondPromptTemplate = ChatPromptTemplate.fromMessages([
      ['system', this.secondPrompt],
      new MessagesPlaceholder('messages'),
      HumanMessagePromptTemplate.fromTemplate('{data}'),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
    ]);

    this.chainFirstLLM = firstPromptTemplate
      .pipe(
        this.firstLlm.bind({
          tools: options.tools.map((tool) => convertToOpenAITool(tool)),
          tool_choice: 'required',
        }) as any,
      )
      .pipe(new JsonOutputToolsParser() as any);

    this.chainSecondLLM = secondPromptTemplate.pipe(this.secondLlm as any);
    this.tools = options.tools;
    return this.chainFirstLLM;
  };

  createChain = (content: { input: string; messages: string[] }) => {
    const { input, messages } = content;
    const toolsByName = Object.fromEntries(
      this.tools.map((t) => [t.name.toLowerCase(), t]),
    );
    return RunnableSequence.from([
      this.chainFirstLLM,
      async (x) => {
        for (const dt of x) {
          if (dt.type.toLowerCase() === 'no_response') {
            const tool = toolsByName['no_response'];
            return [
              {
                tool: 'no_response',
                tool_response: await tool.invoke(dt.args),
              },
            ];
          }
        }
        return await Promise.all(
          x.map(async (dt) => {
            const tool = toolsByName[dt.type.toLowerCase()];
            return {
              tool: dt,
              tool_response: await tool.invoke(dt.args),
            };
          }),
        );
      },
      (data: { tool; tool_response }[]) => {
        return {
          input,
          messages,
          data: JSON.stringify(
            data.map((dt) => {
              console.log(dt, '+++ TOOL CALL +++');
              const toolResult = JSON.parse(dt.tool_response);
              if (toolResult.status == 200) {
                return {
                  tool: dt.tool,
                  response: toolResult.data,
                };
              } else if (toolResult.status == 500) {
                return {
                  tool: dt.tool,
                  status: toolResult.status,
                  response: toolResult.data,
                };
              } else {
                return {
                  tool: dt.tool,
                  error: toolResult.error,
                  status: toolResult.status,
                };
              }
            }),
          ),
        };
      },
      async (data) => {
        // console.log(JSON.parse(data?.data), 'ccccccc');
        for (const item of JSON.parse(data?.data)) {
          if (item.status === 500) {
            return { status: 500, data: item?.response };
          }
        }
        return this.chainSecondLLM.invoke(data);
      },
    ]).withConfig({ runName: 'AnalyticToolsAgent' });
  };

  invoke = async (input: string, messages: string[]) => {
    const chain = this.createChain({
      input: input,
      messages: messages,
    });
    const result = await chain.invoke({
      input: input,
      messages: messages,
    });
    return result;
  };
}
