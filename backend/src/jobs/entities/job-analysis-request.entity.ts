import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CoverLetterReport } from '../../cover-letter/entities/cover-letter-report.entity';
import { JobAnalysisRequestStatus } from '../../ai/entities/ai.enums';

@Entity({ name: 'job_analysis_requests' })
export class JobAnalysisRequest {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string;

  @Column({ name: 'job_title', type: 'varchar', length: 255 })
  jobTitle: string;

  @Column({ name: 'jd_text', type: 'text' })
  jdText: string;

  @Column({ name: 'keywords_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  keywordsJson: string[];

  @Column({ name: 'skills_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  skillsJson: string[];

  @Column({ name: 'source_type', type: 'varchar', length: 50, nullable: true })
  sourceType: string | null;

  @Column({
    type: 'enum',
    enum: JobAnalysisRequestStatus,
    default: JobAnalysisRequestStatus.PENDING,
  })
  status: JobAnalysisRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => CoverLetterReport, (coverLetterReport) => coverLetterReport.jobAnalysisRequest)
  coverLetterReports: CoverLetterReport[];
}
