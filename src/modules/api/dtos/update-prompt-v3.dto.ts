import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePromptV3Dto {
  @ApiProperty({ required: false, description: 'First prompt text' })
  @IsString()
  @IsOptional()
  prompt_first?: string;

  @ApiProperty({ required: false, description: 'Second prompt text' })
  @IsString()
  @IsOptional()
  prompt_second?: string;
}
