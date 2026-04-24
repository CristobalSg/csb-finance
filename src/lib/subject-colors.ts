import type { Subject } from "../types";

export const subjectPalette = [
  "#e10600",
  "#e78177",
  "#ff5a1f",
  "#f8bf24",
  "#35ba73",
  "#0b8a44",
  "#1e9ae2",
  "#4d57bf",
  "#7583cf",
  "#8d23b5",
];

export const getSubjectColor = (index: number) => subjectPalette[index % subjectPalette.length];

export const normalizeSubjects = (subjects: Array<Omit<Subject, "color"> & Partial<Pick<Subject, "color">>>) =>
  subjects.map((subject, index) => ({
    ...subject,
    color: subject.color ?? getSubjectColor(index),
  }));

export const getNextSubjectColor = (subjects: Subject[]) => getSubjectColor(subjects.length);
