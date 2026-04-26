export interface StartInterviewRequest {
  sessionId: string;
  userId: string;
  companyName: string;
  positionName: string;
  jdText: string;
  documents: {
    coverLetterText?: string;
    resumeText?: string;
    portfolioText?: string;
  };
}

export interface ProcessInterviewAnswerRequest {
  userId: string;
  sessionId: string;
  turnNumber: number;
  answerType: 'VIDEO' | 'TEXT';
  answerVideoStorageKey?: string;
  answerText?: string;
  transcriptHint?: string;
  videoDurationSeconds?: number;
  hasAudio?: boolean;
  severeNoise?: boolean;
  faceDetectedRatio?: number;
  multiFaceDetected?: boolean;
  lowLight?: boolean;
  obstructionDetected?: boolean;
  gazeStable?: boolean;
}

export interface FinishInterviewRequest {
  userId: string;
  sessionId: string;
  reason: string;
}
