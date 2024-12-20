import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MyTweetEntity } from '@/database/entities';

export class MyTweetRepository extends Repository<MyTweetEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MyTweetEntity, dataSource.createEntityManager());
  }
}
