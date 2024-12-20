import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { TweetEntity } from '../entities/tweet.entity';

export class TweetRepository extends Repository<TweetEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(TweetEntity, dataSource.createEntityManager());
  }
}
