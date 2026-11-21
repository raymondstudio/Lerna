export type RoomStatus = "lobby" | "in_progress" | "completed" | "abandoned";
export type ParticipantStatus = "joined" | "ready" | "active" | "submitted" | "disconnected";

export interface ArenaQuestion {
  id: string;
  order: number;
  question: string;
  options: string[];
  // correct_answer and explanation are omitted for active quiz security
  correctAnswer?: string;
  explanation?: string;
}

export interface ArenaParticipant {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isReady: boolean;
  status: ParticipantStatus;
  score: number;
  totalAnswered: number;
  timeTakenSeconds?: number | null;
  answers?: Record<string, string>;
  submittedAt?: string | null;
}

export interface ArenaRoom {
  id: string;
  code: string;
  hostId: string;
  title: string;
  courseId?: string | null;
  materialId?: string | null;
  questionCount: number;
  durationSeconds: number;
  status: RoomStatus;
  startedAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  participants: ArenaParticipant[];
  questions: ArenaQuestion[];
  isHost?: boolean;
}

export interface CreateRoomInput {
  title?: string;
  courseId?: string;
  materialId?: string;
  questionCount?: number;
  durationSeconds?: number;
}
