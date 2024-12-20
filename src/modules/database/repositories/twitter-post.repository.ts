import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { TwitterPostEntity } from '@/database/entities';

export class TwitterPostRepository extends Repository<TwitterPostEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(TwitterPostEntity, dataSource.createEntityManager());
  }
}
