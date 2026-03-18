export interface StartInterviewRequest {
  userId: string;
  companyName: string;
  positionName: string;
  jdText: string;
}

export interface ProcessInterviewAnswerRequest {
  userId: string;
  sessionId: string;
}

export interface FinishInterviewRequest {
  userId: string;
  sessionId: string;
}
