import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ITokenPopularResponse {
  @ApiPropertyOptional()
  logoURI: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  symbol: string;

  @ApiProperty()
  supply: number;

  @ApiProperty()
  totalSellToken: number;

  @ApiProperty()
  totalSellSolana: number;

  @ApiProperty()
  totalSellUSD: number;

  // @ApiProperty()
  // avgSellPrice: number;

  @ApiProperty()
  totalBuyToken: number;

  @ApiProperty()
  totalBuySolana: number;

  @ApiProperty()
  totalBuyUSD: number;

  // @ApiProperty()
  // avgBuyPrice: number;

  // @ApiProperty()
  // currPrice: number;

  @ApiPropertyOptional()
  athTokenPrice?: number;

  @ApiProperty()
  holdTime: number;

  @ApiProperty()
  solanaPrice: number;

  // New properties added
  @ApiProperty()
  paperhandedBagSol: number;

  @ApiProperty()
  ATHWorth: number;

  @ApiProperty()
  boughtAtMCC: number;

  @ApiProperty()
  soldAtMCC: number;

  @ApiProperty()
  athMCC: number;

  @ApiProperty()
  pnl: number;

  @ApiProperty()
  pnlPercent: number;

  @ApiProperty()
  fumbledUSD: number;

  @ApiProperty()
  fumbledSolana: number;
}
