// dataroom.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { FileEntity } from '../../files/entities/file.entity';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity()
export class Dataroom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  uploader: string;

  @OneToOne(() => FileEntity, { cascade: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;

  @RelationId((dataroom: Dataroom) => dataroom.file)
  fileId: number;

  constructor(partial: Partial<Dataroom>) {
    Object.assign(this, partial);
  }
}
