import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GenerateNewDto {
  @ApiProperty({
    description: 'Question',
    example: 'What is the price of $Taro?',
  })
  @IsNotEmpty()
  @IsString()
  question: string;

  @ApiProperty({
    description: 'Number of news',
    example: 50,
  })
  @IsNotEmpty()
  @IsNumber()
  new_count: number;
}
