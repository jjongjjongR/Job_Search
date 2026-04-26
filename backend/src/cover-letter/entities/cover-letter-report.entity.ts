import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JobAnalysisRequest } from '../../jobs/entities/job-analysis-request.entity';

@Entity({ name: 'cover_letter_reports' })
export class CoverLetterReport {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'job_analysis_request_id', type: 'varchar', length: 64 })
  jobAnalysisRequestId: string;

  @ManyToOne(() => JobAnalysisRequest, (jobAnalysisRequest) => jobAnalysisRequest.coverLetterReports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_analysis_request_id' })
  jobAnalysisRequest: JobAnalysisRequest;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string;

  @Column({ name: 'job_title', type: 'varchar', length: 255 })
  jobTitle: string;

  @Column({ name: 'total_score', type: 'integer' })
  totalScore: number;

  @Column({ name: 'jd_alignment_score', type: 'integer', nullable: true })
  jdAlignmentScore: number | null;

  @Column({ name: 'job_fit_score', type: 'integer', nullable: true })
  jobFitScore: number | null;

  @Column({ name: 'confidence', type: 'real', nullable: true })
  confidence: number | null;

  @Column({
    name: 'verified_jd_keywords_json',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  verifiedJdKeywordsJson: string[];

  @Column({ name: 'summary_text', type: 'text' })
  summaryText: string;

  @Column({ name: 'revised_draft_text', type: 'text', nullable: true })
  revisedDraftText: string | null;

  @Column({
    name: 'question_scores_json',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  questionScoresJson: {
    questionNumber: number;
    title: string;
    score: number;
    feedback: string;
  }[];

  @Column({
    name: 'rubric_scores_json',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  rubricScoresJson: {
    category: string;
    score: number;
    maxScore: number;
    evidenceText: string;
    evidenceSource: string;
    verified: boolean;
  }[];

  @Column({
    name: 'rag_evidence_json',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  ragEvidenceJson: {
    source: string;
    text: string;
    score: number;
  }[];

  @Column({ name: 'strengths_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  strengthsJson: string[];

  @Column({ name: 'weaknesses_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  weaknessesJson: string[];

  @Column({ name: 'guide_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  guideJson: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
