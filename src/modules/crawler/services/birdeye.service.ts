import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseRequestService } from './base-request.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export enum EChainName {
  SOLANA = 'solana',
}
interface TokenHolderResponse {
  data: {
    items: TokenHolder[];
  };
  success: boolean;
}

interface TokenHolder {
  amount: string;
  decimals: number;
  mint: string;
  owner: string;
  token_account: string;
  ui_amount: number;
}

export interface TokenOverviewResponse {
  data: TokenOverviewData;
  success: boolean;
}

interface TokenOverviewData {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  extensions: TokenExtensions;
  logoURI: string;
  liquidity: number;
  lastTradeUnixTime: number;
  lastTradeHumanTime: string;
  price: number;

  // Price history and changes
  history30mPrice: number;
  priceChange30mPercent: number;
  history1hPrice: number;
  priceChange1hPercent: number;
  history2hPrice: number;
  priceChange2hPercent: number;
  history4hPrice: number;
  priceChange4hPercent: number;
  history6hPrice: number;
  priceChange6hPercent: number;
  history8hPrice: number;
  priceChange8hPercent: number;
  history12hPrice: number;
  priceChange12hPercent: number;
  history24hPrice: number;
  priceChange24hPercent: number;

  // Wallet statistics
  uniqueWallet30m: number;
  uniqueWalletHistory30m: number;
  uniqueWallet30mChangePercent: number;
  // ... similar pattern for 1h, 2h, 4h, 8h, 24h

  // Supply and market cap
  supply: number;
  mc: number;
  circulatingSupply: number;
  realMc: number;
  holder: number;

  // Trading statistics for different time periods (30m, 1h, 2h, 4h, 8h, 24h)
  trade30m: number;
  tradeHistory30m: number;
  trade30mChangePercent: number;
  sell30m: number;
  sellHistory30m: number;
  sell30mChangePercent: number;
  buy30m: number;
  buyHistory30m: number;
  buy30mChangePercent: number;
  v30m: number;
  v30mUSD: number;
  vHistory30m: number;
  vHistory30mUSD: number;
  v30mChangePercent: number;
  vBuy30m: number;
  vBuy30mUSD: number;
  vBuyHistory30m: number;
  vBuyHistory30mUSD: number;
  vBuy30mChangePercent: number;
  vSell30m: number;
  vSell30mUSD: number;
  vSellHistory30m: number;
  vSellHistory30mUSD: number;
  vSell30mChangePercent: number;
  // ... similar pattern repeats for 1h, 2h, 4h, 8h, 24h

  watch: null;
  numberMarkets: number;
}

interface TokenExtensions {
  coingeckoId: string;
  serumV3Usdc: string;
  serumV3Usdt: string;
  website: string;
  telegram: string | null;
  twitter: string;
  description: string;
  discord: string;
  medium: string;
}

@Injectable()
export class BirdEyeService extends BaseRequestService {
  private birdeyeApiKeys;
  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(BirdEyeService.name)
    private readonly logger: PinoLogger,
  ) {
    super(
      configService.get<string>('crawler.birdeye.base_url'),
      configService.get<string>('crawler.birdeye.api_key').split(',')[0],
    );
    this.birdeyeApiKeys = configService
      .get<string>('crawler.birdeye.api_key')
      .split(',');
  }

  protected getKey(): string {
    return this.birdeyeApiKeys[
      Math.floor(Math.random() * this.birdeyeApiKeys.length)
    ];
  }

  protected _buildHeader(): Record<string, string> {
    // const headers = super._buildHeader();
    return {
      // ...headers,
      'X-API-KEY': this.getKey(),
      'x-chain': EChainName.SOLANA,
    };
  }

  async getTokenHoldersBirdeye(
    address: string,
    chain: string,
  ): Promise<TokenHolderResponse> {
    try {
      const url = 'defi/v3/token/holder';
      const response = await this.sendRequest({
        method: 'GET',
        url: url,
        params: {
          address,
          offset: 0,
          limit: 100,
        },
        headers: { ...this._buildHeader(), 'x-chain': chain },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching token holders:', error);
      throw error;
    }
  }

  async getTokenOverview(
    address: string,
    chain: string = 'solana',
  ): Promise<TokenOverviewResponse> {
    try {
      const url = 'defi/token_overview';
      const response = await this.sendRequest({
        method: 'GET',
        url: url,
        params: {
          address,
        },
        headers: { ...this._buildHeader(), 'x-chain': chain },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching token overview:', error);
      throw error;
    }
  }
}
