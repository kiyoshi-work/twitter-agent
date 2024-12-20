import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetTokenPopularDTO } from '../dtos/token.dto';
import { TokenService } from '@/business/services/token.service';
import { FormatResponseInterceptor } from '../interceptors';
import { PaginateDto } from '@/shared/pagination/paginate.dto';
import { GetTokenInfoTool } from '@/ai/tools/get-token-info.tool';

@ApiTags('tokens')
@Controller('tokens')
export class TokenController {
  constructor(private tokenService: TokenService) {}

  @Inject(GetTokenInfoTool)
  private readonly getTokenInfoTool: GetTokenInfoTool;

  @ApiBaseResponse(class {}, {
    statusCode: HttpStatus.OK,
    isArray: true,
    isPaginate: true,
  })
  @ResponseMessage('Get data successfully')
  @UseInterceptors(FormatResponseInterceptor)
  //   @UseInterceptors(HttpCacheInterceptor)
  //   @CacheTTL(10000)
  //   @UseGuards(CustomThrottlerGuard)
  //   @Throttle(20, 60)
  @Get('/popular')
  async popular(@Query() query: GetTokenPopularDTO) {
    return await this.tokenService.getShilledTokens(query);
  }

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
  @Get('/:symbol')
  async getToken(@Param('symbol') symbol: string, @Query() query: PaginateDto) {
    return await this.tokenService.getToken(symbol, query);
  }

  @ApiBaseResponse(class {}, {
    statusCode: HttpStatus.OK,
    isArray: false,
  })
  @ResponseMessage('Get token info successfully')
  @UseInterceptors(FormatResponseInterceptor)
  @Get('/info/:ticker')
  async getTokenByTicker(@Param('ticker') ticker: string) {
    return await this._getTokenByTicker(ticker);
  }

  private async _getTokenByTicker(ticker: string) {
    try {
      const tokenInfo = await this.getTokenInfoTool._call({ symbol: ticker });
      if (!tokenInfo) {
        throw new BadRequestException('Token info not found');
      }
      return JSON.parse(tokenInfo);
    } catch (error) {
      throw new BadRequestException('Failed to get token info');
    }
  }
}
