import { UserRepository } from '@/database/repositories';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private userRepository: UserRepository) {}

  funErr() {
    console.log('Test error ');
    try {
      throw new Error('Test error');
    } catch (e) {
      throw e;
    }
  }

  @Get('')
  @ResponseMessage('Hello')
  async healthCheck() {
    return 1;
  }

  @Get('check-db')
  async checkDB() {
    return await this.userRepository.findOne({ where: {} });
  }

  @Get('throw')
  throwError() {
    this.funErr();
  }
}
