import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SearchTweetMentionDto {
  @ApiProperty({ description: 'Symbol to search for' })
  @IsString()
  symbol: string;
}
