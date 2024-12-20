import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ShilledTokenEntity } from '../entities/shilled-token.entity';

export class ShilledTokenRepository extends Repository<ShilledTokenEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(ShilledTokenEntity, dataSource.createEntityManager());
  }
}
