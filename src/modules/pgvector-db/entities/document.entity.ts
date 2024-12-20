import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  EntitySchema,
  Index,
  CreateDateColumn,
} from 'typeorm';

export enum EPostSource {
  Twitter = 'Twitter',
}
// export const DocumentSchema = new EntitySchema<DocumentEntity>({
//   name: 'documents',
//   columns: {
//     id: {
//       generated: 'uuid',
//       type: 'uuid',
//       primary: true,
//     },
//     pageContent: {
//       type: String,
//     },
//     metadata: {
//       type: 'jsonb',
//     },
//     embedding: {
//       type: String,
//     },
//   },
// });
@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  pageContent?: string;

  @Column({ type: 'jsonb' })
  metadata: string;

  @Column()
  embedding: string;

  @CreateDateColumn()
  @Index()
  post_created: Date;

  @Column()
  tags: string;

  @Column()
  post_id: string;

  @Column({
    nullable: true,
    // enum: EPostSource,
    default: EPostSource.Twitter,
  })
  post_source: EPostSource;
}
