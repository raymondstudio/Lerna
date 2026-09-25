export type ChatReferenceKind = "course" | "material";

export type ChatReference = {
  id: string;
  kind: ChatReferenceKind;
  title: string;
  code?: string;
  fileType?: string;
  courseCode?: string;
};

export type ChatReferenceSelection = {
  courseId?: string;
  materialId?: string;
};
