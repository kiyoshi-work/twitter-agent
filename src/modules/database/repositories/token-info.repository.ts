import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { TokenInfoEntity } from '@/database/entities';

export class TokenInfoRepository extends Repository<TokenInfoEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(TokenInfoEntity, dataSource.createEntityManager());
  }
}
