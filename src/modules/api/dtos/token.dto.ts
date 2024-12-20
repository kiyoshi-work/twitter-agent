import { PaginateDto } from '@/shared/pagination/paginate.dto';
import { RequireWith } from '@/shared/validator/decorators/requireWith';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString } from 'class-validator';

export class GetTokenPopularDTO extends PaginateDto {
  @ApiPropertyOptional({
    description: 'From Date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from_date: Date;

  @ApiPropertyOptional({
    description: 'To Date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to_date: Date;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'total_favorite_count',
    'avg_popularity_score',
    'avg_post_created',
    'post_count',
  ])
  @RequireWith(['sort_type'])
  sort_field?: string;
}
