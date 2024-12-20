import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class SwapDTO {
  @ApiProperty()
  fromToken: string;
  @ApiProperty()
  toToken: string;
  @ApiProperty()
  amount: number;
  @ApiPropertyOptional()
  @IsOptional()
  privateKey: string;
}
