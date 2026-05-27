'use client';

// 2026-05-05 신규: 15단계에서 실제 면접 API 흐름을 프론트 화면에 연결
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
  Mic,
  Play,
  Send,
  Square,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';

// 2026-05-05 신규: 면접 시작 API 응답 타입을 화면에서 안전하게 사용
type InterviewQuestion = {
  questionType: string;
  questionText: string;
};

// 2026-05-05 신규: 면접 시작 API 응답 타입을 추가
type StartInterviewSessionResponse = {
  sessionId: string;
  documentSufficiency: string;
  status: string;
  currentQuestionNumber: number;
  maxQuestionCount: number;
  question: InterviewQuestion;
};

// 2026-05-05 신규: 답변 제출 API 응답 타입을 추가
type SubmitInterviewAnswerResponse = {
  sessionId: string;
  turnNumber: number;
  evaluation: {
    answerFullText: string;
    feedbackText: string;
    nonverbalSummaryText: string;
    visionResultStatus: string;
  };
  decision: {
    type: string;
    message: string;
    followUpCountForCurrentQuestion?: number | null;
    retryCount?: number | null;
    nextQuestion?: InterviewQuestion | null;
  };
};

// 2026-05-05 신규: 최종 리포트 API 응답 타입을 추가
type FinishInterviewSessionResponse = {
  sessionId: string;
  status: string;
  finishedAt: string;
  finalReport?: {
    totalScore: number;
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    practiceDirections: string[];
    questionAnswers: {
      turnNumber: number;
      questionText: string;
      answerFullText: string;
    }[];
    turnFeedbacks: {
      turnNumber: number;
      questionText: string;
      feedbackText: string;
      nonverbalSummaryText: string;
    }[];
  } | null;
};

// 2026-05-05 신규: 업로드 API 응답 타입을 추가
type UploadInterviewAnswerResponse = {
  storageKey: string;
  originalName: string;
  size: number;
};

// 2026-05-05 신규: 최신 JD 분석 결과를 면접 시작 화면에 자동 세팅하기 위한 타입
type JobAnalysisDetailResponse = {
  jobAnalysisRequestId: string;
  companyName: string;
  positionName: string;
  jdText: string;
  status: string;
  createdAt: string;
};

// 2026-05-05 신규: 화면 입력 상태를 한 곳에서 관리
const initialStartForm = {
  jobAnalysisRequestId: '',
  companyName: '',
  positionName: '',
  jdText: '',
  coverLetterText: '',
  resumeText: '',
  portfolioText: '',
};

// 2026-05-05 신규: 영상 인식 실패가 무한 반복되어 토큰이 계속 쓰이는 문제를 막기 위한 화면 제한값
const MAX_VIDEO_RETRY_COUNT = 2;

// 2026-05-05 신규: 브라우저 음성 인식 API를 타입 충돌 없이 사용하기 위한 최소 타입
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

export default function InterviewPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [startForm, setStartForm] = useState(initialStartForm);
  const [session, setSession] = useState<StartInterviewSessionResponse | null>(null);
  const [latestJobAnalysis, setLatestJobAnalysis] =
    useState<JobAnalysisDetailResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [answerMode, setAnswerMode] = useState<'TEXT' | 'VIDEO'>('TEXT');
  const [answerText, setAnswerText] = useState('');
  const [transcriptHint, setTranscriptHint] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState('');
  // 2026-05-05 신규: 녹화 종료 시점의 실제 길이를 저장해 제출 대기 시간이 영상 길이에 섞이지 않게 함
  const [recordedDurationSeconds, setRecordedDurationSeconds] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingLatestJob, setIsLoadingLatestJob] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [history, setHistory] = useState<SubmitInterviewAnswerResponse[]>([]);
  const [finalResult, setFinalResult] = useState<FinishInterviewSessionResponse | null>(null);
  // 2026-05-05 신규: 같은 턴에서 영상 재시도 횟수를 화면에서도 제한
  const [videoRetryCount, setVideoRetryCount] = useState(0);
  // 2026-05-05 신규: 실제 녹화 스트림에 오디오 트랙이 있었는지 서버에 정확히 전달
  const [recordingHasAudio, setRecordingHasAudio] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    const accessToken = getAccessToken();

    // 2026-05-05 신규: 로그인 토큰이 없으면 보호 API 호출 화면 대신 로그인 안내를 보여줌
    if (!currentUser || !accessToken) {
      setUser(null);
      return;
    }

    setUser(currentUser);
    loadLatestJobAnalysis();
  }, []);

  useEffect(() => {
    if (!recordedUrl || !videoRef.current) {
      return;
    }

    videoRef.current.src = recordedUrl;
  }, [recordedUrl]);

  useEffect(() => {
    return () => {
      stopBrowserTranscription();
      clearVideoElementSource();
      stopMediaStream();
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const handleStartSession = async () => {
    // 2026-05-05 신규: 면접 시작 직전에도 토큰을 확인해 보호 API 실패를 줄임
    if (!getAccessToken()) {
      setUser(null);
      setErrorMessage('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setFinalResult(null);
    setHistory([]);
    setIsStarting(true);

    try {
      const created = await apiRequest<StartInterviewSessionResponse>(
        '/ai/interview/sessions/start',
        {
          method: 'POST',
          body: JSON.stringify({
            jobAnalysisRequestId: startForm.jobAnalysisRequestId || undefined,
            companyName: startForm.companyName || undefined,
            positionName: startForm.positionName || undefined,
            jdText: startForm.jdText || undefined,
            documents: {
              coverLetterText: startForm.coverLetterText || undefined,
              resumeText: startForm.resumeText || undefined,
              portfolioText: startForm.portfolioText || undefined,
            },
          }),
        },
      );

      setSession(created);
      setCurrentQuestion(created.question);
      setTurnNumber(created.currentQuestionNumber);
      setAnswerText('');
      setTranscriptHint('');
      setRecordedBlob(null);
      clearRecordedVideo();
      // 2026-05-05 신규: 새 세션 시작 시 이전 영상 길이 값을 초기화
      setRecordedDurationSeconds(null);
      // 2026-05-05 신규: 새 세션 시작 시 영상 재시도 횟수를 초기화
      setVideoRetryCount(0);
      // 2026-05-05 신규: 새 세션 시작 시 녹화 오디오 상태를 초기화
      setRecordingHasAudio(null);
      setStatusMessage('면접 세션이 시작되었습니다.');
    } catch (error) {
      handleApiError(error, '면접 세션 시작에 실패했습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  const loadLatestJobAnalysis = async () => {
    setIsLoadingLatestJob(true);

    try {
      const latest = await apiRequest<JobAnalysisDetailResponse | null>(
        '/jobs/analysis-requests/latest',
      );
      if (!latest) {
        return;
      }

      setLatestJobAnalysis(latest);
      setStartForm((current) => ({
        ...current,
        jobAnalysisRequestId: latest.jobAnalysisRequestId,
        companyName: latest.companyName,
        positionName: latest.positionName,
        jdText: latest.jdText,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      }
    } finally {
      setIsLoadingLatestJob(false);
    }
  };

  const handleStartRecording = async () => {
    setErrorMessage('');
    setStatusMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      // 2026-05-05 신규: 브라우저가 실제로 마이크 트랙을 제공했는지 저장
      setRecordingHasAudio(stream.getAudioTracks().length > 0);
      // 2026-05-05 수정: 영상 답변 내용을 사용자가 직접 쓰지 않도록 녹화 시작과 동시에 자동 전사를 시작
      setTranscriptHint('');
      setTranscriptStatus('');
      startBrowserTranscription();
      speakCurrentQuestionOnce();
      // 2026-05-05 신규: React state 반영 전에도 정확한 녹화 시작 시간을 계산하기 위한 로컬 값
      const recordingStartedAt = Date.now();
      // 2026-05-05 신규: 녹화 중에는 현재 카메라 화면을 바로 보여줌
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => undefined);
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : undefined,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finishedAt = Date.now();
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const nextUrl = URL.createObjectURL(blob);
        if (recordedUrl) {
          clearVideoElementSource();
          URL.revokeObjectURL(recordedUrl);
        }
        setRecordedBlob(blob);
        setRecordedUrl(nextUrl);
        // 2026-05-05 신규: 실제 녹화 시간만 저장해 AI 서버에 전달
        setRecordedDurationSeconds(
          Math.max(1, Math.round((finishedAt - recordingStartedAt) / 1000)),
        );
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        stopMediaStream();
      };

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recorder.start();
    } catch {
      setErrorMessage('카메라/마이크 권한을 허용해야 영상 답변을 녹화할 수 있습니다.');
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    mediaRecorderRef.current.stop();
    stopBrowserTranscription();
    setIsRecording(false);
  };

  const handleSubmitAnswer = async () => {
    if (!session || !currentQuestion) {
      setErrorMessage('먼저 면접 세션을 시작해 주세요.');
      return;
    }

    if (!getAccessToken()) {
      setUser(null);
      setErrorMessage('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    if (answerMode === 'TEXT' && !answerText.trim()) {
      setErrorMessage('텍스트 답변을 입력해 주세요.');
      return;
    }

    if (answerMode === 'VIDEO' && !recordedBlob) {
      setErrorMessage('영상 답변을 먼저 녹화해 주세요.');
      return;
    }

    // 2026-05-05 신규: 같은 턴에서 영상 재시도가 너무 많으면 텍스트 답변으로 전환해 비용 낭비를 막음
    if (answerMode === 'VIDEO' && videoRetryCount >= MAX_VIDEO_RETRY_COUNT) {
      setAnswerMode('TEXT');
      setErrorMessage('영상 인식 재시도 한도를 넘었습니다. 이번 턴은 텍스트 답변으로 진행해 주세요.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);

    try {
      const uploadedVideo =
        answerMode === 'VIDEO' && recordedBlob
          ? await uploadRecordedVideo(recordedBlob)
          : null;

      const submitted = await apiRequest<SubmitInterviewAnswerResponse>(
        `/ai/interview/sessions/${session.sessionId}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({
            turnNumber,
            answerType: answerMode,
            answerText: answerMode === 'TEXT' ? answerText : undefined,
            transcriptHint: transcriptHint || undefined,
            answerVideoStorageKey: uploadedVideo?.storageKey,
            videoDurationSeconds: getRecordedDurationSeconds(),
            hasAudio: answerMode === 'VIDEO' ? Boolean(recordingHasAudio) : undefined,
            severeNoise: false,
          }),
        },
      );

      setHistory((current) => [...current, submitted]);
      applyDecision(submitted);
    } catch (error) {
      handleApiError(error, '면접 답변 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishSession = async () => {
    if (!session) {
      setErrorMessage('종료할 면접 세션이 없습니다.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setIsFinishing(true);

    try {
      const finished = await apiRequest<FinishInterviewSessionResponse>(
        `/ai/interview/sessions/${session.sessionId}/finish`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'USER_FINISHED' }),
        },
      );

      setFinalResult(finished);
      setStatusMessage(
        finished.status === 'CANCELLED'
          ? '5문항 미만으로 종료되어 최종 리포트가 생성되지 않았습니다.'
          : '최종 리포트가 생성되었습니다.',
      );
    } catch (error) {
      handleApiError(error, '면접 종료에 실패했습니다.');
    } finally {
      setIsFinishing(false);
    }
  };

  const uploadRecordedVideo = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, `interview-answer-${turnNumber}.webm`);

    return apiRequest<UploadInterviewAnswerResponse>('/ai/interview/sessions/uploads', {
      method: 'POST',
      body: formData,
    });
  };

  const applyDecision = (submitted: SubmitInterviewAnswerResponse) => {
    const { decision } = submitted;
    setStatusMessage(decision.message);

    if (decision.type === 'RETRY_UPLOAD') {
      const nextRetryCount = decision.retryCount ?? videoRetryCount + 1;
      setVideoRetryCount(nextRetryCount);
      if (nextRetryCount >= MAX_VIDEO_RETRY_COUNT) {
        setAnswerMode('TEXT');
        setRecordedBlob(null);
        clearRecordedVideo();
        setRecordedDurationSeconds(null);
        setRecordingHasAudio(null);
        setStatusMessage('영상 인식 재시도 한도에 도달했습니다. 이번 턴은 텍스트 답변으로 진행해 주세요.');
      }
      return;
    }

    if (decision.type === 'REQUEST_TEXT') {
      setAnswerMode('TEXT');
      setAnswerText(submitted.evaluation.answerFullText);
      return;
    }

    setAnswerText('');
    setTranscriptHint('');
    setRecordedBlob(null);
    clearRecordedVideo();
    // 2026-05-05 신규: 다음 답변으로 넘어갈 때 이전 녹화 길이를 초기화
    setRecordedDurationSeconds(null);
    // 2026-05-05 신규: 다음 답변으로 넘어갈 때 이전 녹화 오디오 상태를 초기화
    setRecordingHasAudio(null);
    // 2026-05-05 신규: 다음 질문으로 넘어가면 영상 재시도 횟수를 초기화
    setVideoRetryCount(0);

    if (decision.nextQuestion) {
      setCurrentQuestion(decision.nextQuestion);
      setTurnNumber((current) => current + 1);
      return;
    }

    if (decision.type === 'FINISH_SESSION') {
      setCurrentQuestion(null);
      setStatusMessage('면접 질문이 모두 끝났습니다. 최종 리포트를 생성해 주세요.');
    }
  };

  const getRecordedDurationSeconds = () => {
    if (answerMode !== 'VIDEO') {
      return undefined;
    }

    return recordedDurationSeconds ?? undefined;
  };

  const stopMediaStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearVideoElementSource = () => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.pause();
    videoRef.current.removeAttribute('src');
    videoRef.current.srcObject = null;
    videoRef.current.load();
  };

  const clearRecordedVideo = () => {
    clearVideoElementSource();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl('');
  };

  const speakCurrentQuestionOnce = () => {
    if (!currentQuestion || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.questionText);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startBrowserTranscription = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognitionConstructor =
      (
        window as Window &
          typeof globalThis & {
            webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
            SpeechRecognition?: new () => BrowserSpeechRecognition;
          }
      ).SpeechRecognition ??
      (
        window as Window &
          typeof globalThis & {
            webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
            SpeechRecognition?: new () => BrowserSpeechRecognition;
          }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setTranscriptStatus('이 브라우저는 실시간 자동 전사를 지원하지 않습니다. 제출 후 서버 STT로 전사합니다.');
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setTranscriptHint(transcript.trim());
      setTranscriptStatus('실시간 전사 중입니다.');
    };
    recognition.onerror = (event) => {
      const reason = event?.error ? ` (${event.error})` : '';
      setTranscriptStatus(`브라우저 실시간 전사가 중단되었습니다${reason}. 제출 후 서버 STT로 전사합니다.`);
    };
    recognition.onend = () => {
      setTranscriptStatus((current) =>
        transcriptHint.trim() || current.includes('서버 STT')
          ? current
          : '브라우저 실시간 전사가 종료되었습니다. 제출 후 서버 STT로 전사합니다.',
      );
    };
    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
      setTranscriptStatus('브라우저 실시간 전사를 시작했습니다.');
    } catch {
      speechRecognitionRef.current = null;
      setTranscriptStatus('브라우저 실시간 전사를 시작하지 못했습니다. 제출 후 서버 STT로 전사합니다.');
    }
  };

  const stopBrowserTranscription = () => {
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // 2026-05-05 신규: 브라우저 음성 인식 중지 실패는 녹화 제출 흐름을 막지 않음
    } finally {
      speechRecognitionRef.current = null;
    }
  };

  const handleApiError = (error: unknown, fallbackMessage: string) => {
    setErrorMessage(error instanceof ApiError ? error.message : fallbackMessage);

    if (error instanceof ApiError && error.status === 401) {
      setUser(null);
    }
  };

  const handleSpeakQuestion = () => {
    if (!currentQuestion || typeof window === 'undefined' || !window.speechSynthesis) {
      setErrorMessage('현재 브라우저에서 TTS를 사용할 수 없습니다.');
      return;
    }

    // 2026-05-05 신규: 이전 질문 음성이 남아 있으면 멈추고 현재 질문만 읽음
    speakCurrentQuestionOnce();
  };

  if (!user) {
    return (
      <FeatureShell
        eyebrow="AI Interview"
        title="로그인 후 AI 면접을 시작할 수 있습니다"
        description="면접 세션, 답변 제출, 최종 리포트는 로그인한 사용자 기준으로 저장됩니다."
      >
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
          <LoginRequiredCard
            title="로그인이 필요합니다"
            description="JWT 인증 후 면접 세션을 시작하고 답변 기록을 저장할 수 있습니다."
          />
        </div>
      </FeatureShell>
    );
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--page-panel)] p-6 shadow-[0_24px_80px_rgba(16,36,61,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              AI Interview
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">AI 면접 연습</h1>
            <p className="mt-4 max-w-3xl leading-7 text-[var(--text-muted)]">
              질문을 듣고 답변을 제출한 뒤 최종 리포트를 확인합니다.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
        </div>

        <section className="mt-6 rounded-[8px] border border-[var(--border-soft)] bg-white p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-xl font-bold">면접 시작 정보</h2>
          </div>

          <div className="mt-5 grid gap-4">
            {latestJobAnalysis && (
              <div className="rounded-[8px] bg-[var(--success-soft)] p-4 text-sm leading-6 text-green-800">
                최근 JD 분석 결과가 자동으로 입력되었습니다.
                <br />
                {latestJobAnalysis.companyName} / {latestJobAnalysis.positionName}
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold">
              공고 분석 ID
              <input
                className="rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal"
                placeholder={isLoadingLatestJob ? '최근 분석 결과 확인 중' : '자동 입력 또는 선택 입력'}
                value={startForm.jobAnalysisRequestId}
                onChange={(event) =>
                  setStartForm((current) => ({
                    ...current,
                    jobAnalysisRequestId: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              회사명
              <input
                className="rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal"
                placeholder="예: 온세상이취업"
                value={startForm.companyName}
                onChange={(event) =>
                  setStartForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              직무명
              <input
                className="rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal"
                placeholder="예: 백엔드 개발자"
                value={startForm.positionName}
                onChange={(event) =>
                  setStartForm((current) => ({
                    ...current,
                    positionName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              JD 본문
              <textarea
                className="min-h-28 rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal leading-6"
                placeholder="채용공고 핵심 내용을 입력하세요."
                value={startForm.jdText}
                onChange={(event) =>
                  setStartForm((current) => ({
                    ...current,
                    jdText: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              자소서 텍스트
              <textarea
                className="min-h-24 rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal leading-6"
                placeholder="선택 입력"
                value={startForm.coverLetterText}
                onChange={(event) =>
                  setStartForm((current) => ({
                    ...current,
                    coverLetterText: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={isStarting || isLoadingLatestJob}
            onClick={handleStartSession}
            type="button"
          >
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            면접 시작
          </button>
        </section>

        <section className="mt-6 rounded-[8px] border border-[var(--border-soft)] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">
                {session ? `${turnNumber}번 질문` : '대기 중'}
              </p>
              <h2 className="mt-1 text-xl font-bold">현재 질문</h2>
            </div>
            {session && (
              <span className="rounded-[8px] bg-[var(--card-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)]">
                {session.status} / {session.documentSufficiency}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-[8px] bg-[var(--card-soft)] p-5">
            <p className="text-sm font-semibold text-[var(--accent)]">
              {currentQuestion?.questionType ?? '질문 없음'}
            </p>
            <p className="mt-2 leading-7">
              {currentQuestion?.questionText ?? '면접 시작 정보를 입력하고 면접을 시작하세요.'}
            </p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              disabled={!currentQuestion}
              onClick={handleSpeakQuestion}
              type="button"
            >
              <Volume2 className="h-4 w-4" />
              질문 듣기
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-[8px] bg-[var(--card-soft)] p-1">
            <button
              className={`inline-flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-sm font-semibold ${
                answerMode === 'TEXT' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'
              }`}
              onClick={() => setAnswerMode('TEXT')}
              type="button"
            >
              <Mic className="h-4 w-4" />
              텍스트
            </button>
            <button
              className={`inline-flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-sm font-semibold ${
                answerMode === 'VIDEO' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'
              }`}
              onClick={() => setAnswerMode('VIDEO')}
              type="button"
            >
              <Video className="h-4 w-4" />
              영상
            </button>
          </div>

          {answerMode === 'TEXT' ? (
            <label className="mt-5 grid gap-2 text-sm font-semibold">
              답변
              <textarea
                className="min-h-36 rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal leading-6"
                placeholder="질문에 대한 답변을 입력하세요."
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
              />
            </label>
          ) : (
            <div className="mt-5 rounded-[8px] border border-[var(--border-soft)] p-4">
              <video
                ref={videoRef}
                className="aspect-video w-full rounded-[8px] bg-black"
                controls
                muted={isRecording}
                playsInline
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isRecording}
                  onClick={handleStartRecording}
                  type="button"
                >
                  <Video className="h-4 w-4" />
                  녹화 시작
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
                  disabled={!isRecording}
                  onClick={handleStopRecording}
                  type="button"
                >
                  <Square className="h-4 w-4" />
                  녹화 종료
                </button>
              </div>
              <label className="mt-4 grid gap-2 text-sm font-semibold">
                자동 전사 결과
                <textarea
                  className="min-h-24 rounded-[8px] border border-[var(--border-soft)] px-4 py-3 font-normal leading-6"
                  placeholder="녹화 중 음성이 자동으로 전사됩니다. 브라우저가 지원하지 않으면 서버 STT만 사용합니다."
                  readOnly
                  value={transcriptHint}
                />
              </label>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {transcriptStatus ||
                  '자동 전사가 비어 있어도 제출할 수 있고, 서버 STT가 영상을 전사합니다.'}
              </p>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                영상 재시도 {videoRetryCount}/{MAX_VIDEO_RETRY_COUNT}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
              disabled={!session || isSubmitting || !currentQuestion}
              onClick={handleSubmitAnswer}
              type="button"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              답변 제출
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] px-5 py-3 font-semibold disabled:opacity-60"
              disabled={!session || isFinishing}
              onClick={handleFinishSession}
              type="button"
            >
              {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              리포트 생성
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 flex gap-2 rounded-[8px] bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div className="mt-4 flex gap-2 rounded-[8px] bg-[var(--success-soft)] p-4 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {statusMessage}
            </div>
          )}
        </section>
      </div>

      {history.length > 0 && (
        <section className="mt-6 rounded-[8px] border border-[var(--border-soft)] bg-white p-6">
          <h2 className="text-xl font-bold">답변 피드백</h2>
          <div className="mt-4 grid gap-4">
            {history.map((item) => (
              <article
                className="rounded-[8px] border border-[var(--border-soft)] p-4"
                key={`${item.sessionId}-${item.turnNumber}-${item.decision.type}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{item.turnNumber}번 답변</p>
                  <span className="rounded-[8px] bg-[var(--card-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                    {item.decision.type} / Vision {item.evaluation.visionResultStatus}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  {item.evaluation.feedbackText}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {item.evaluation.nonverbalSummaryText}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {finalResult && (
        <section className="mt-6 rounded-[8px] border border-[var(--border-soft)] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">{finalResult.status}</p>
              <h2 className="mt-1 text-xl font-bold">최종 리포트</h2>
            </div>
            <span className="rounded-[8px] bg-[var(--card-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
              {finalResult.finishedAt}
            </span>
          </div>

          {finalResult.finalReport ? (
            <div className="mt-5 grid gap-4">
              <div className="rounded-[8px] bg-[var(--card-soft)] p-5">
                <p className="text-3xl font-bold text-[var(--accent)]">
                  {finalResult.finalReport.totalScore}점
                </p>
                <p className="mt-2 font-semibold">{finalResult.finalReport.grade}</p>
                <p className="mt-3 leading-7 text-[var(--text-muted)]">
                  {finalResult.finalReport.summary}
                </p>
              </div>
              <ReportList title="강점" items={finalResult.finalReport.strengths} />
              <ReportList title="보완점" items={finalResult.finalReport.weaknesses} />
              <ReportList title="연습 방향" items={finalResult.finalReport.practiceDirections} />
            </div>
          ) : (
            <p className="mt-5 rounded-[8px] bg-[var(--warning-soft)] p-4 leading-7 text-[var(--text-muted)]">
              5문항 미만으로 종료되어 최종 리포트가 생성되지 않았습니다.
            </p>
          )}
        </section>
      )}
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[8px] border border-[var(--border-soft)] p-4">
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--text-muted)]">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
