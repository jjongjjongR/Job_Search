// file.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
} from 'typeorm';
import { Dataroom } from '../../dataroom/entities/dataroom.entity';

@Entity()
export class FileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  uploader: string;

  @Column()
  filename: string;

  @Column()
  originalname: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => Dataroom, (dataroom) => dataroom.file, {
    onDelete: 'CASCADE',
  })
  dataroom: Dataroom;
}
