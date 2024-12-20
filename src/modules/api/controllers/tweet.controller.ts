import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TokenService } from '@/business/services/token.service';
import { FormatResponseInterceptor } from '../interceptors';
import { TweetService } from '@/business/services/tweet.service';
import { GetTweetDTO } from '../dtos/tweet.dto';

@ApiTags('tweets')
@Controller('tweets')
export class TweetController {
  constructor(private tweetService: TweetService) {}
  @ApiBaseResponse(class {}, {
    statusCode: HttpStatus.OK,
    isArray: false,
    isPaginate: true,
  })
  @ResponseMessage('Get data successfully')
  @UseInterceptors(FormatResponseInterceptor)
  //   @UseInterceptors(HttpCacheInterceptor)
  //   @CacheTTL(10000)
  //   @UseGuards(CustomThrottlerGuard)
  //   @Throttle(20, 60)
  @Get('/:username')
  async getToken(
    @Param('username') username: string,
    @Query() query: GetTweetDTO,
  ) {
    return await this.tweetService.getTweetsAndInfoByUsername(username, query);
  }
}
