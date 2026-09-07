"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileText, FileUp, FolderOpen, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud, Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_UPLOAD_SESSION_TITLE, buildUploadPath, getAcceptedUploadMimeTypes, isAllowedUploadMimeType, UPLOADED_MATERIALS_BUCKET } from "@/lib/uploads/constants";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";
import type { StudySessionRecord } from "@/lib/study-sessions/types";

type SessionsApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    sessions: StudySessionRecord[];
  };
  error?: {
    code: string;
    message: string;
  };
};

type SessionCreateApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    session: StudySessionRecord;
  };
  error?: {
    code: string;
    message: string;
  };
};

type MaterialsApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    materials: UploadedMaterialRecord[];
    material?: UploadedMaterialRecord;
    signedUrl?: string;
  };
  error?: {
    code: string;
    message: string;
  };
};

type StorageRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  file_name: string;
  file_type: string;
  storage_path: string;
  created_at: string;
  status?: UploadedMaterialRecord["status"];
  error_message?: string | null;
  processed_at?: string | null;
  chunk_count?: number;
  summary?: string | null;
  source_metadata?: Record<string, unknown> | null;
  deleted_at?: string | null;
};

function sortSessions(sessions: StudySessionRecord[]) {
  return [...sessions].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function sortMaterials(materials: UploadedMaterialRecord[]) {
  return [...materials].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function mapMaterialRow(row: StorageRow): UploadedMaterialRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    fileName: row.file_name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    status: row.status ?? "uploaded",
    errorMessage: row.error_message ?? null,
    processedAt: row.processed_at ?? null,
    chunkCount: row.chunk_count ?? 0,
    summary: row.summary ?? null,
    sourceMetadata: row.source_metadata ?? {},
    deletedAt: row.deleted_at ?? null,
  };
}

function formatFileTypeLabel(fileType: string) {
  if (!fileType) {
    return "File";
  }

  if (fileType.startsWith("image/")) {
    return fileType.replace("image/", "Image ");
  }

  if (fileType === "application/pdf") {
    return "PDF";
  }

  if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "DOCX";
  }

  if (fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return "PPTX";
  }

  if (fileType === "text/plain") {
    return "Text";
  }

  return fileType;
}

function getStatusTone(status: UploadedMaterialRecord["status"]) {
  if (status === "ready") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "failed") {
    return "border-red-300/20 bg-red-400/10 text-red-100";
  }

  if (status === "processing") {
    return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function getStatusIcon(status: UploadedMaterialRecord["status"]) {
  if (status === "ready") {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (status === "failed") {
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }

  if (status === "processing") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  return <Clock3 className="h-3.5 w-3.5" />;
}

export function UploadWorkspace() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<UploadedMaterialRecord[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [activeSessionId, sessions]);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sessions;
    }

    return sessions.filter((session) =>
      [session.title, session.topicCategory, session.lastMessage].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query, sessions]);

  const activeMaterials = useMemo(
    () => sortMaterials(materials.filter((material) => material.sessionId === activeSessionId)),
    [activeSessionId, materials]
  );

  useEffect(() => {
    if (!ready || !user) {
      setLoadingSessions(false);
      return;
    }

    let isMounted = true;

    void (async () => {
      setLoadingSessions(true);
      setError(null);

      try {
        const response = await fetch("/api/study-sessions", { method: "GET" });
        const payload = (await response.json()) as SessionsApiResponse;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "Unable to load sessions.");
        }

        const nextSessions = sortSessions(payload.data?.sessions ?? []);
        setSessions(nextSessions);
        setActiveSessionId((current) => {
          if (current && nextSessions.some((session) => session.id === current)) {
            return current;
          }

          return nextSessions[0]?.id ?? null;
        });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load sessions.");
      } finally {
        if (isMounted) {
          setLoadingSessions(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user || !supabase || !activeSessionId) {
      setMaterials([]);
      setLoadingMaterials(false);
      return;
    }

    let isMounted = true;

    void (async () => {
      setLoadingMaterials(true);
      setError(null);

      const response = await fetch(`/api/materials?sessionId=${encodeURIComponent(activeSessionId)}`);
      const payload = (await response.json()) as MaterialsApiResponse;

      if (!isMounted) {
        return;
      }

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Unable to load uploads.");
        setLoadingMaterials(false);
        return;
      }

      setMaterials(payload.data?.materials ?? []);
      setLoadingMaterials(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [activeSessionId, ready, supabase, user]);

  async function createSession(title = DEFAULT_UPLOAD_SESSION_TITLE) {
    const response = await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, topicCategory: "Materials" }),
    });

    const payload = (await response.json()) as SessionCreateApiResponse;

    if (!response.ok || !payload.success || !payload.data?.session) {
      throw new Error(payload.error?.message || "Unable to create an upload session.");
    }

    setSessions((current) => sortSessions([payload.data!.session, ...current.filter((session) => session.id !== payload.data!.session.id)]));
    setActiveSessionId(payload.data.session.id);
    return payload.data.session;
  }

  async function ensureActiveSession(fileName: string) {
    if (activeSession) {
      return activeSession;
    }

    const baseName = fileName.replace(/\.[^.]+$/, "").trim();
    return createSession(baseName ? `Materials: ${baseName}` : DEFAULT_UPLOAD_SESSION_TITLE);
  }

  async function refreshMaterials(sessionId: string) {
    if (!supabase) {
      return;
    }

    const response = await fetch(`/api/materials?sessionId=${encodeURIComponent(sessionId)}`);
    const payload = (await response.json()) as MaterialsApiResponse;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message ?? "Unable to load uploads.");
    }

    setMaterials(payload.data?.materials ?? []);
  }

  async function handleFiles(fileList: FileList | File[]) {
    if (!supabase || !user) {
      setError("Supabase is not configured or the user is not available.");
      return;
    }

    const files = Array.from(fileList).filter((file) => isAllowedUploadMimeType(file.type));
    if (files.length === 0) {
      setError("Supported files: PDF, DOCX, PPTX, TXT, PNG, JPG, JPEG, and WEBP.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const session = await ensureActiveSession(files[0].name);

      for (const file of files) {
        const storagePath = buildUploadPath(user.id, session.id, file.name);
        const { error: uploadError } = await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

        if (uploadError) {
          throw uploadError;
        }

        const insertRes = await fetch("/api/materials", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId: session.id,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            storagePath,
            fileSize: file.size
          })
        });

        const insertPayload = await insertRes.json();
        if (!insertPayload.success || !insertPayload.data) {
          await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).remove([storagePath]);
          throw new Error(insertPayload.error?.message || "Unable to save upload metadata.");
        }

        const insertedRow = insertPayload.data;

        setMaterials((current) => sortMaterials([mapMaterialRow(insertedRow as StorageRow), ...current.filter((item) => item.id !== insertedRow.id)]));

        const processResponse = await fetch(`/api/materials/${insertedRow.id}/process`, {
          method: "POST",
        });
        const processPayload = (await processResponse.json()) as MaterialsApiResponse;

        if (!processResponse.ok || !processPayload.success) {
          setError(processPayload.error?.message ?? `${file.name} uploaded, but processing failed.`);
        }
      }

      await refreshMaterials(session.id);
      setSessions((current) =>
        sortSessions(
          current.map((item) =>
            item.id === session.id
              ? {
                  ...item,
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        )
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload files.");
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenMaterial(material: UploadedMaterialRecord) {
    const response = await fetch(`/api/materials/${material.id}/view`, { method: "POST" });
    const payload = (await response.json()) as MaterialsApiResponse;

    if (!response.ok || !payload.success || !payload.data?.signedUrl) {
      setError(payload.error?.message || "Unable to open the file.");
      return;
    }

    window.open(payload.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteMaterial(material: UploadedMaterialRecord) {
    const response = await fetch(`/api/materials/${material.id}`, { method: "DELETE" });
    const payload = (await response.json()) as MaterialsApiResponse;

    if (!response.ok || !payload.success) {
      setError(payload.error?.message || "Unable to delete the file.");
      return;
    }

    setMaterials((current) => current.filter((item) => item.id !== material.id));
  }

  async function handleReprocessMaterial(material: UploadedMaterialRecord) {
    setMaterials((current) => current.map((item) => (item.id === material.id ? { ...item, status: "processing", errorMessage: null } : item)));

    const response = await fetch(`/api/materials/${material.id}/process`, { method: "POST" });
    const payload = (await response.json()) as MaterialsApiResponse;

    if (!response.ok || !payload.success) {
      setError(payload.error?.message || "Unable to reprocess the file.");
    }

    if (activeSessionId) {
      await refreshMaterials(activeSessionId);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 lg:flex-row">
      <aside className="hidden h-full min-h-0 w-[20rem] shrink-0 flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-glow lg:flex">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">My materials</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Document library</h2>
          </div>
          <Button type="button" size="icon" onClick={() => createSession()} aria-label="New upload session">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-slate-950/40 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions" className="border-0 bg-transparent px-0 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-0" />
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {loadingSessions ? (
            <div className="rounded-[1.25rem] border border-dashed border-white/10 p-4 text-sm text-slate-400">Loading sessions...</div>
          ) : filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full rounded-[1.5rem] border px-3 py-3 text-left transition-colors ${
                  session.id === activeSessionId ? "border-cyan-300/25 bg-cyan-400/10" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <p className="truncate text-sm font-medium text-slate-100">{session.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{session.topicCategory}</p>
              </button>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-white/10 p-4 text-sm text-slate-400">No sessions yet. Create one to start uploading.</div>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 shadow-glow sm:p-6">
        <div className="flex shrink-0 flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">My materials</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Teach Lerna from your study files</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Upload notes, slides, PDFs, documents, and images. Lerna extracts, chunks, embeds, and links them to your tutoring sessions.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock3 className="h-4 w-4" />
            {activeSession ? `${activeMaterials.length} file${activeMaterials.length === 1 ? "" : "s"} in this session` : "No session selected"}
          </div>
        </div>

        {error ? <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}

        <Card
          className={`border-dashed transition-colors ${dragging ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/15 bg-white/[0.03]"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-cyan-300" />
              Drop files here
            </CardTitle>
            <CardDescription>
              PDF, DOCX, PPTX, TXT, PNG, JPG, JPEG, and WEBP files are stored privately, processed, and made searchable for tutoring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-[2rem] border border-dashed border-white/10 bg-slate-950/30 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-cyan-300">
                <FileUp className="h-7 w-7" />
              </div>
              <div className="max-w-xl space-y-2">
                <p className="text-base font-medium text-white">{activeSession ? activeSession.title : "Create or pick a session first"}</p>
                <p className="text-sm leading-6 text-slate-400">
                  Drag files in, or choose them manually. Lerna will process them into searchable learning chunks after upload.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  Select files
                </Button>
                <Button type="button" variant="outline" onClick={() => void createSession()} disabled={uploading}>
                  <Plus className="h-4 w-4" />
                  New session
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={getAcceptedUploadMimeTypes()}
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) {
                    void handleFiles(event.target.files);
                    event.target.value = "";
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-cyan-300" />
                Session files
              </CardTitle>
              <CardDescription>Everything saved in the selected session appears here.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMaterials ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 p-4 text-sm text-slate-400">Loading uploads...</div>
              ) : activeMaterials.length > 0 ? (
                <div className="space-y-3">
                  {activeMaterials.map((material) => (
                    <div key={material.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{material.fileName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{formatFileTypeLabel(material.fileType)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${getStatusTone(material.status)}`}>
                              {getStatusIcon(material.status)}
                              {material.status}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300">
                              {material.chunkCount} chunk{material.chunkCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-xs text-slate-500">Uploaded {new Date(material.createdAt).toLocaleString()}</span>
                          </div>
                          {material.summary ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{material.summary}</p> : null}
                          {material.errorMessage ? <p className="mt-3 text-sm leading-6 text-red-200">{material.errorMessage}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <Button type="button" variant="ghost" size="icon" onClick={() => void handleOpenMaterial(material)} aria-label={`Open ${material.fileName}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void handleReprocessMaterial(material)} aria-label={`Reprocess ${material.fileName}`}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteMaterial(material)} aria-label={`Delete ${material.fileName}`} className="text-red-200 hover:bg-red-500/10 hover:text-red-100">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 p-4 text-sm text-slate-400">
                  No uploads in this session yet. Add a file and it will be stored here across devices.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle>Current session</CardTitle>
              <CardDescription>Files are linked to the same study session record that chat uses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</p>
                <p className="mt-2 text-base font-medium text-white">{activeSession?.title ?? "No session selected"}</p>
                <p className="mt-2 text-sm text-slate-400">{activeSession?.topicCategory ?? "Select or create a session to begin."}</p>
                {activeSession && (
                  <Button
                    type="button"
                    onClick={() => router.push(`/chat?sessionId=${activeSession.id}`)}
                    className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Brain className="h-4 w-4" />
                    Continue Learning
                  </Button>
                )}
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Storage path</p>
                <p className="mt-2 break-all text-sm text-slate-300">{activeMaterials[0]?.storagePath ?? "A storage path will appear after the first upload."}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
