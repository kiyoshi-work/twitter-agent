import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PostTweetDto {
  @ApiPropertyOptional({
    description: 'The username of the Twitter user',
  })
  @IsString()
  @IsOptional()
  username: string;

  @ApiProperty({
    description: 'The content of the tweet',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
