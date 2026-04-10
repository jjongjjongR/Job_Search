import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  DocumentSufficiencyStatus,
  InterviewSessionStatus,
} from '../../ai/entities/ai.enums';
import { InterviewTurn } from './interview-turn.entity';

@Entity({ name: 'interview_sessions' })
export class InterviewSession {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string;

  @Column({ name: 'job_title', type: 'varchar', length: 255 })
  jobTitle: string;

  @Column({ name: 'jd_text', type: 'text' })
  jdText: string;

  @Column({
    name: 'sufficiency_status',
    type: 'enum',
    enum: DocumentSufficiencyStatus,
  })
  sufficiencyStatus: DocumentSufficiencyStatus;

  @Column({
    type: 'enum',
    enum: InterviewSessionStatus,
    default: InterviewSessionStatus.IN_PROGRESS,
  })
  status: InterviewSessionStatus;

  @Column({ name: 'total_question_count', type: 'integer', default: 0 })
  totalQuestionCount: number;

  @Column({ name: 'answered_count', type: 'integer', default: 0 })
  answeredCount: number;

  @Column({ name: 'final_total_score', type: 'integer', nullable: true })
  finalTotalScore: number | null;

  @Column({ name: 'final_grade', type: 'varchar', length: 50, nullable: true })
  finalGrade: string | null;

  @Column({ name: 'final_summary', type: 'text', nullable: true })
  finalSummary: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamp with time zone', nullable: true })
  finishedAt: Date | null;

  @OneToMany(() => InterviewTurn, (interviewTurn) => interviewTurn.session)
  turns: InterviewTurn[];
}
