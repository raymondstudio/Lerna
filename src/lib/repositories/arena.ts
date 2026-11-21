import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ArenaParticipant, ArenaQuestion, ArenaRoom, CreateRoomInput, RoomStatus } from "@/types/arena";
import { OperationError } from "./operations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Repository Operations
// ---------------------------------------------------------------------------

export async function createArenaRoom(
  hostId: string,
  hostName: string,
  hostAvatarUrl: string | null | undefined,
  input: CreateRoomInput,
  questions: Array<{
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  }>
): Promise<ArenaRoom> {
  const db = createSupabaseAdminClient();
  const code = generateRoomCode();
  const title = input.title || "Study Showdown";
  const questionCount = questions.length;
  const durationSeconds = input.durationSeconds ?? 300;

  // 1. Create Room
  const { data: room, error: roomError } = await db
    .from("quiz_rooms")
    .insert({
      code,
      host_id: hostId,
      course_id: input.courseId ?? null,
      material_id: input.materialId ?? null,
      title,
      question_count: questionCount,
      duration_seconds: durationSeconds,
      status: "lobby",
    })
    .select("*")
    .single();

  if (roomError || !room) {
    console.error("[arena-repo] Failed to create room:", roomError);
    throw new OperationError("Could not create study room. Please retry.");
  }

  // 2. Insert Questions
  const questionRows = questions.map((q, idx) => ({
    room_id: room.id,
    question_order: idx + 1,
    question_text: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
  }));

  const { error: qError } = await db.from("quiz_room_questions").insert(questionRows);
  if (qError) {
    console.error("[arena-repo] Failed to insert questions:", qError);
    await db.from("quiz_rooms").delete().eq("id", room.id);
    throw new OperationError("Could not save battle questions.");
  }

  // 3. Add Host as First Participant
  const { error: partError } = await db.from("quiz_room_participants").insert({
    room_id: room.id,
    user_id: hostId,
    display_name: hostName || "Host",
    avatar_url: hostAvatarUrl || null,
    is_ready: true,
    status: "joined",
  });

  if (partError) {
    console.error("[arena-repo] Failed to add host participant:", partError);
  }

  return getArenaRoomByCode(code, hostId);
}

export async function getArenaRoomByCode(
  code: string,
  currentUserId?: string
): Promise<ArenaRoom> {
  const db = createSupabaseAdminClient();

  const { data: room, error: roomError } = await db
    .from("quiz_rooms")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .single();

  if (roomError || !room) {
    throw new OperationError("Room not found.", 404);
  }

  // Check if room timer has expired while still 'in_progress'
  if (room.status === "in_progress" && room.ends_at) {
    const endsAtTime = new Date(room.ends_at).getTime();
    if (Date.now() > endsAtTime + 2000) {
      // Mark completed automatically
      await db
        .from("quiz_rooms")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", room.id);
      room.status = "completed";
    }
  }

  // Fetch Participants
  const { data: participants } = await db
    .from("quiz_room_participants")
    .select("*")
    .eq("room_id", room.id)
    .order("score", { ascending: false })
    .order("time_taken_seconds", { ascending: true });

  const mappedParticipants: ArenaParticipant[] = (participants || []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    isReady: p.is_ready,
    status: p.status,
    score: p.score ?? 0,
    totalAnswered: p.total_answered ?? 0,
    timeTakenSeconds: p.time_taken_seconds ? Number(p.time_taken_seconds) : null,
    answers: (p.answers as Record<string, string>) || {},
    submittedAt: p.submitted_at,
  }));

  // Fetch Questions (Redact answers if the battle is NOT completed)
  const isCompleted = room.status === "completed";
  const { data: questions } = await db
    .from("quiz_room_questions")
    .select("id, question_order, question_text, options, correct_answer, explanation")
    .eq("room_id", room.id)
    .order("question_order", { ascending: true });

  const mappedQuestions: ArenaQuestion[] = (questions || []).map((q) => ({
    id: q.id,
    order: q.question_order,
    question: q.question_text,
    options: (q.options as string[]) || [],
    correctAnswer: isCompleted ? q.correct_answer : undefined,
    explanation: isCompleted ? q.explanation : undefined,
  }));

  return {
    id: room.id,
    code: room.code,
    hostId: room.host_id,
    title: room.title,
    courseId: room.course_id,
    materialId: room.material_id,
    questionCount: room.question_count,
    durationSeconds: room.duration_seconds,
    status: room.status as RoomStatus,
    startedAt: room.started_at,
    endsAt: room.ends_at,
    createdAt: room.created_at,
    participants: mappedParticipants,
    questions: mappedQuestions,
    isHost: currentUserId ? room.host_id === currentUserId : false,
  };
}

export async function joinArenaRoom(
  code: string,
  userId: string,
  displayName: string,
  avatarUrl?: string | null
): Promise<ArenaRoom> {
  const db = createSupabaseAdminClient();
  const cleanCode = code.toUpperCase().trim();

  const { data: room, error: roomError } = await db
    .from("quiz_rooms")
    .select("id, status")
    .eq("code", cleanCode)
    .single();

  if (roomError || !room) {
    throw new OperationError("Room not found.", 404);
  }

  if (room.status !== "lobby" && room.status !== "in_progress") {
    throw new OperationError("This battle has already ended.", 400);
  }

  // Upsert Participant
  const { error: partError } = await db.from("quiz_room_participants").upsert(
    {
      room_id: room.id,
      user_id: userId,
      display_name: displayName || "Student",
      avatar_url: avatarUrl || null,
      is_ready: true,
      status: room.status === "in_progress" ? "active" : "joined",
    },
    { onConflict: "room_id,user_id" }
  );

  if (partError) {
    console.error("[arena-repo] Failed to join room:", partError);
    throw new OperationError("Could not join room. Please retry.");
  }

  return getArenaRoomByCode(cleanCode, userId);
}

export async function startArenaBattle(code: string, hostId: string): Promise<ArenaRoom> {
  const db = createSupabaseAdminClient();
  const cleanCode = code.toUpperCase().trim();

  const { data: room, error: roomError } = await db
    .from("quiz_rooms")
    .select("id, host_id, duration_seconds, status")
    .eq("code", cleanCode)
    .single();

  if (roomError || !room) throw new OperationError("Room not found.", 404);
  if (room.host_id !== hostId) throw new OperationError("Only the room host can start the battle.", 403);
  if (room.status !== "lobby") throw new OperationError("Battle is already started or finished.", 400);

  const now = new Date();
  const endsAt = new Date(now.getTime() + room.duration_seconds * 1000);

  const { error: updateError } = await db
    .from("quiz_rooms")
    .update({
      status: "in_progress",
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", room.id);

  if (updateError) {
    console.error("[arena-repo] Failed to start battle:", updateError);
    throw new OperationError("Could not start battle.");
  }

  // Update participants to active
  await db
    .from("quiz_room_participants")
    .update({ status: "active" })
    .eq("room_id", room.id);

  return getArenaRoomByCode(cleanCode, hostId);
}

export async function updateArenaProgress(
  code: string,
  userId: string,
  totalAnswered: number,
  answers: Record<string, string>
): Promise<void> {
  const db = createSupabaseAdminClient();
  const cleanCode = code.toUpperCase().trim();

  const { data: room } = await db
    .from("quiz_rooms")
    .select("id, status")
    .eq("code", cleanCode)
    .single();

  if (!room || room.status !== "in_progress") return;

  await db
    .from("quiz_room_participants")
    .update({
      total_answered: totalAnswered,
      answers,
    })
    .eq("room_id", room.id)
    .eq("user_id", userId);
}

export async function submitArenaAnswers(
  code: string,
  userId: string,
  answers: Record<string, string>,
  timeTakenSeconds?: number
): Promise<ArenaRoom> {
  const db = createSupabaseAdminClient();
  const cleanCode = code.toUpperCase().trim();

  const { data: room } = await db
    .from("quiz_rooms")
    .select("id, status, started_at, ends_at, duration_seconds")
    .eq("code", cleanCode)
    .single();

  if (!room) throw new OperationError("Room not found.", 404);

  // Fetch actual correct answers from database
  const { data: questions } = await db
    .from("quiz_room_questions")
    .select("id, correct_answer")
    .eq("room_id", room.id);

  if (!questions) throw new OperationError("Questions could not be verified.");

  // Calculate score
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] && answers[q.id] === q.correct_answer) {
      score += 1;
    }
  }

  const now = new Date();
  const computedTimeTaken =
    timeTakenSeconds ??
    (room.started_at
      ? Math.min(room.duration_seconds, (now.getTime() - new Date(room.started_at).getTime()) / 1000)
      : room.duration_seconds);

  await db
    .from("quiz_room_participants")
    .update({
      score,
      total_answered: Object.keys(answers).length,
      answers,
      time_taken_seconds: computedTimeTaken,
      status: "submitted",
      submitted_at: now.toISOString(),
    })
    .eq("room_id", room.id)
    .eq("user_id", userId);

  // Check if ALL participants have submitted
  const { data: allParticipants } = await db
    .from("quiz_room_participants")
    .select("status")
    .eq("room_id", room.id);

  const allSubmitted = (allParticipants || []).every(
    (p) => p.status === "submitted" || p.status === "disconnected"
  );

  if (allSubmitted) {
    await db
      .from("quiz_rooms")
      .update({ status: "completed", updated_at: now.toISOString() })
      .eq("id", room.id);
  }

  return getArenaRoomByCode(cleanCode, userId);
}

export async function getUserRecentRooms(userId: string): Promise<ArenaRoom[]> {
  const db = createSupabaseAdminClient();

  const { data: participations } = await db
    .from("quiz_room_participants")
    .select("room_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(10);

  if (!participations || participations.length === 0) return [];

  const roomIds = participations.map((p) => p.room_id);

  const { data: rooms } = await db
    .from("quiz_rooms")
    .select("*")
    .in("id", roomIds)
    .order("created_at", { ascending: false });

  if (!rooms) return [];

  return rooms.map((r) => ({
    id: r.id,
    code: r.code,
    hostId: r.host_id,
    title: r.title,
    courseId: r.course_id,
    materialId: r.material_id,
    questionCount: r.question_count,
    durationSeconds: r.duration_seconds,
    status: r.status as RoomStatus,
    startedAt: r.started_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    participants: [],
    questions: [],
    isHost: r.host_id === userId,
  }));
}
