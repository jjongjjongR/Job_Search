import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { InterviewSession } from './interview-session.entity';
import { InterviewQuestionType } from '../../ai/entities/ai.enums';

@Entity({ name: 'interview_turns' })
export class InterviewTurn {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId: string;

  @ManyToOne(() => InterviewSession, (interviewSession) => interviewSession.turns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: InterviewSession;

  @Column({ name: 'turn_index', type: 'integer' })
  turnIndex: number;

  @Column({
    name: 'question_type',
    type: 'enum',
    enum: InterviewQuestionType,
  })
  questionType: InterviewQuestionType;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ name: 'answer_video_title', type: 'varchar', length: 255, nullable: true })
  answerVideoTitle: string | null;

  @Column({ name: 'answer_full_text', type: 'text', nullable: true })
  answerFullText: string | null;

  @Column({ name: 'feedback_text', type: 'text', nullable: true })
  feedbackText: string | null;

  @Column({ name: 'nonverbal_summary_text', type: 'text', nullable: true })
  nonverbalSummaryText: string | null;

  @Column({ name: 'content_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  contentScore: number | null;

  @Column({ name: 'nonverbal_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  nonverbalScore: number | null;

  @Column({ name: 'total_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  totalScore: number | null;

  @Column({ name: 'is_followup', type: 'boolean', default: false })
  isFollowup: boolean;

  @Column({ name: 'stt_fallback_used', type: 'boolean', default: false })
  sttFallbackUsed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
