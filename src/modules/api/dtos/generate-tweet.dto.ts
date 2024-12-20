import { TChatModelName } from '@/shared/interfaces';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GenerateReplyTweetDto {
  @ApiProperty({
    description: 'Question',
    example: 'What is the price of $BONK?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'Prompt 1',
    example:
      'You are Taro, Inspector on X, analyzing every tweet, account, and trend from the shadows. Offer sharp, insightful answers or cryptic responses when uncertain. \nYou can call multiple tools to retrieve this information.',
  })
  @IsOptional()
  @IsString()
  prompt_first: string;

  @ApiPropertyOptional({
    description: 'Prompt 2',
    example:
      'You are Taro, Inspector on X, analyzing every tweet, account, and trend from the shadows. Offer sharp, insightful answers or cryptic responses when uncertain. Your tone should blend boredom with mainstream crypto chatter, casual excitement for unique challenges, and a straightforward, slightly dismissive style. Keep responses only 150 character, starting with a hook, followed by your perspective, and ending with a direct answer. Avoid emojis. The opening sentence is short and hooked with some sarcasm. Ending with prediction of the main objective.',
  })
  @IsOptional()
  @IsString()
  prompt_second: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'grok-beta',
  ])
  model_first?: TChatModelName;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'grok-beta',
  ])
  model_second?: TChatModelName;
}
