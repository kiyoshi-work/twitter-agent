import { Body, Controller, Post, Patch, Get, Query } from '@nestjs/common';
import { AiService } from '@/ai/services/ai.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GenerateReplyTweetDto } from '../dtos/generate-tweet.dto';
import { AdminConfigRepository } from '@/database/repositories';
import { UpdatePromptV3Dto } from '../dtos/update-prompt-v3.dto';
import handleResponse from '@/twitter/controllers/twitter.controller';
import { SearchTweetMentionDto } from '../dtos/search-tweet-mention.dto';
import { RapidTwitterService } from '@/crawler/services/rapid-twitter.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly adminConfigRepository: AdminConfigRepository,
    private readonly rapidTwitterService: RapidTwitterService,
  ) {}

  @Get('my-project-tool')
  async myProjectTool() {
    const result = await this.aiService.getMyProjectTool._call();
    return handleResponse(this.parseResult(result));
  }

  @Get('twitter-info-tool')
  async getTwitterInfo(@Query() dto: SearchTweetMentionDto) {
    const result = await this.aiService.getTwitterInfoTool._call({
      username: dto.symbol,
    });
    return handleResponse(this.parseResult(result));
  }

  @Get('token-info-tool')
  async tokenInfoTool(@Query() dto: SearchTweetMentionDto) {
    const result = await this.aiService.getTokenInfoTool._call({
      symbol: dto.symbol,
    });
    return handleResponse(this.parseResult(result));
  }

  @Post('generate-reply-tweet')
  @ApiOperation({
    summary: 'Generate Reply Tweet',
    description:
      'Generates a reply tweet using the provided question and model name.',
  })
  async generateReplyTweet(@Body() dto: GenerateReplyTweetDto) {
    const rs = await this.aiService.generateReplyTweetv3({
      question: dto.question,
      model_first: dto.model_first,
      model_second: dto.model_second,
      prompt_first: dto.prompt_first,
      prompt_second: dto.prompt_second,
    });
    return handleResponse(rs);
  }

  @Patch('prompt-v3')
  async updatePromptV3(@Body() dto: UpdatePromptV3Dto) {
    console.log(dto, 'dto');

    const config = await this.adminConfigRepository.findOneByKey('prompt-v3');
    if (!config) {
      throw new Error('Prompt v3 configuration not found');
    }

    const currentData = config.data || {};
    const updatedData = {
      ...currentData,
      ...(dto.prompt_first && { promptFirst: dto.prompt_first }),
      ...(dto.prompt_second && { promptSecond: dto.prompt_second }),
    };

    await this.adminConfigRepository.update(
      { key: 'prompt-v3' },
      { data: updatedData },
    );

    return handleResponse({ message: 'Prompt v3 updated successfully' });
  }

  private parseResult(result: string) {
    return JSON.parse(result)?.data;
  }

  // @Post('generate-new')
  // async generateNew(@Body() dto: GenerateNewDto) {
  //   const rs = await getTwitterNews();

  //   const topNews = rs.slice(0, dto.new_count);

  //   const contents = topNews.map((item) => item.title);

  //   const { result, formattedPrompt } = await this.aiService.generateNew(
  //     dto.question,
  //     contents,
  //   );
  //   return handleResponse({
  //     formattedPrompt,
  //     result,
  //   });
  // }

  @Post('generate-new-v2')
  async generateQuestion() {
    return handleResponse(await this.aiService.generateNewV2());
  }
}
