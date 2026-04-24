/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { useState } from "react";
import type { ReactNode } from "react";

import { initialSubjects, initialTasks } from "../data/seed";
import { migrateLegacyDataIfNeeded, saveAppStateToDb, loadAppStateFromDb } from "../lib/app-db";
import { createId } from "../lib/id";
import { getNextSubjectColor, normalizeSubjects } from "../lib/subject-colors";
import type { Subject, Task, TaskInput } from "../types";

interface AcademicState {
  subjects: Subject[];
  tasks: Task[];
  selectedSubjectId: string | null;
}

type AcademicAction =
  | { type: "hydrate"; payload: Pick<AcademicState, "subjects" | "tasks"> }
  | { type: "add-subject"; payload: Subject }
  | { type: "update-subject"; payload: Subject }
  | { type: "delete-subject"; payload: string }
  | { type: "select-subject"; payload: string | null }
  | { type: "add-task"; payload: Task }
  | { type: "update-task"; payload: Task }
  | { type: "delete-task"; payload: string }
  | { type: "toggle-task"; payload: string };

interface AcademicContextValue extends AcademicState {
  addSubject: (input: Pick<Subject, "name" | "code">) => void;
  updateSubject: (subjectId: string, input: Pick<Subject, "name" | "code">) => void;
  deleteSubject: (subjectId: string) => void;
  selectSubject: (subjectId: string | null) => void;
  addTask: (input: TaskInput) => void;
  updateTask: (taskId: string, input: TaskInput) => void;
  deleteTask: (taskId: string) => void;
  toggleTask: (taskId: string) => void;
}

const initialState: AcademicState = {
  subjects: initialSubjects,
  tasks: initialTasks,
  selectedSubjectId: null,
};

const AcademicContext = createContext<AcademicContextValue | null>(null);

const reducer = (state: AcademicState, action: AcademicAction): AcademicState => {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        subjects: normalizeSubjects(action.payload.subjects),
        tasks: action.payload.tasks,
      };
    case "add-subject":
      return { ...state, subjects: [...state.subjects, action.payload] };
    case "update-subject":
      return {
        ...state,
        subjects: state.subjects.map((subject) => (subject.id === action.payload.id ? action.payload : subject)),
      };
    case "delete-subject":
      return {
        ...state,
        subjects: state.subjects.filter((subject) => subject.id !== action.payload),
        tasks: state.tasks.filter((task) => task.subjectId !== action.payload),
        selectedSubjectId: state.selectedSubjectId === action.payload ? null : state.selectedSubjectId,
      };
    case "select-subject":
      return { ...state, selectedSubjectId: action.payload };
    case "add-task":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "update-task":
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.payload.id ? action.payload : task)),
      };
    case "delete-task":
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.payload) };
    case "toggle-task":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload ? { ...task, completed: !task.completed } : task,
        ),
      };
    default:
      return state;
  }
};

export const AcademicProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    void migrateLegacyDataIfNeeded({ subjects: initialSubjects, tasks: initialTasks }).then(async () => {
      const persistedState = await loadAppStateFromDb();

      if (!persistedState) {
        setHasHydrated(true);
        return;
      }

      dispatch({
        type: "hydrate",
        payload: {
          subjects: persistedState.subjects,
          tasks: persistedState.tasks,
        },
      });

      setHasHydrated(true);
    }).catch(() => {
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    void saveAppStateToDb({ subjects: state.subjects, tasks: state.tasks });
  }, [hasHydrated, state.subjects, state.tasks]);

  const value = useMemo<AcademicContextValue>(
    () => ({
      ...state,
      addSubject: (input) =>
        dispatch({
          type: "add-subject",
          payload: {
            id: createId(),
            name: input.name,
            code: input.code,
            color: getNextSubjectColor(state.subjects),
          },
        }),
      updateSubject: (subjectId, input) => {
        const currentSubject = state.subjects.find((subject) => subject.id === subjectId);

        if (!currentSubject) {
          return;
        }

        dispatch({
          type: "update-subject",
          payload: {
            ...currentSubject,
            name: input.name,
            code: input.code,
          },
        });
      },
      deleteSubject: (subjectId) => dispatch({ type: "delete-subject", payload: subjectId }),
      selectSubject: (subjectId) => dispatch({ type: "select-subject", payload: subjectId }),
      addTask: (input) =>
        dispatch({
          type: "add-task",
          payload: { id: createId(), ...input },
        }),
      updateTask: (taskId, input) =>
        dispatch({
          type: "update-task",
          payload: { id: taskId, ...input },
        }),
      deleteTask: (taskId) => dispatch({ type: "delete-task", payload: taskId }),
      toggleTask: (taskId) => dispatch({ type: "toggle-task", payload: taskId }),
    }),
    [state],
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
};

export const useAcademic = () => {
  const context = useContext(AcademicContext);

  if (!context) {
    throw new Error("useAcademic must be used within AcademicProvider");
  }

  return context;
};
