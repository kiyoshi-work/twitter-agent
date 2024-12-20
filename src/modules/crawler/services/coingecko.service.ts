import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';

@Injectable()
export class CoingeckoService {
  private _key?: string;
  private _host?: string;
  constructor(private readonly configService: ConfigService) {
    this._key = this.configService.get<string>('crawler.coingecko.api_key');
    this._host = `${this.configService.get<string>('crawler.coingecko.host')}`;
  }

  async sendRequest(options: AxiosRequestConfig) {
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async fetchTop100Coin() {
    const url = `${this._host}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`;
    try {
      const response = await this.sendRequest({
        method: 'GET',
        url: url,
        headers: {
          'x-cg-pro-api-key': this._key,
          accept: 'application/json',
        },
      });
      return response;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
}
