import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { TwitterUserEntity } from '../entities/twitter-user.entity';

export class TwitterUserRepository extends Repository<TwitterUserEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(TwitterUserEntity, dataSource.createEntityManager());
  }
}
