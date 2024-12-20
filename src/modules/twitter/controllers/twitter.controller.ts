import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { TwitterService } from '../services/twitter.service';
import { PostTweetDto } from '../dtos';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTwitterUserDto } from '../dtos/create-twitter-user.dto';
import { CreateTwitterUserWithCookiesDto } from '../dtos/create-twitter-user-with-cookies.dto';
import { generateImage } from '@/shared/generate-image';

export default function handleResponse(
  data: any = {},
  status_code: number = HttpStatus.OK,
  msg: string = 'Success',
) {
  return { messages: msg, data, status_code };
}

@ApiTags('Twitter')
@Controller('twitter')
export class TwitterController {
  constructor(private readonly twitterService: TwitterService) {}

  @Post('user')
  @ApiOperation({ summary: 'Create a Twitter user' })
  async createUser(@Body() body: CreateTwitterUserDto) {
    const rs = await this.twitterService.createUser(body);
    return handleResponse(rs);
  }

  @Post('user-cookies')
  @ApiOperation({ summary: 'Create a user with cookies' })
  async createUserWithCookies(@Body() body: CreateTwitterUserWithCookiesDto) {
    const rs = await this.twitterService.createUserWithCookies(body);
    return handleResponse(rs);
  }

  @Post('tweet')
  @ApiOperation({ summary: 'Post a tweet' })
  async post(@Body() body: PostTweetDto) {
    const media = await generateImage(body.content);
    const rs = await this.twitterService.post(
      body.content,
      body.username,
      media,
    );
    return handleResponse(rs);
  }
}
