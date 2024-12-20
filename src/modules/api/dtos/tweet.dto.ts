import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class GetTweetDTO {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => {
    return [true, 'enabled', 'true', '1', 1].indexOf(value) > -1;
  })
  @IsBoolean()
  only_db?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_recursive?: number;
}
