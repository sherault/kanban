import type { ConflictField } from "./types";

export function getActiveConflict(
  titleField: ConflictField,
  descField: ConflictField,
  objField: ConflictField,
  subjectField: ConflictField,
) {
  if (titleField.conflict) {
    return {
      field: "Title",
      info: titleField.conflict,
      resolve: titleField.resolveConflict,
    };
  }
  if (descField.conflict) {
    return {
      field: "Description",
      info: descField.conflict,
      resolve: descField.resolveConflict,
    };
  }
  if (objField.conflict) {
    return {
      field: "Objective",
      info: objField.conflict,
      resolve: objField.resolveConflict,
    };
  }
  if (subjectField.conflict) {
    return {
      field: "Global subject",
      info: subjectField.conflict,
      resolve: subjectField.resolveConflict,
    };
  }
  return null;
}
