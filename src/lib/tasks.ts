import type { Task } from "../types";
import { isWithinDays } from "./date";

export const sortTasksByDate = (tasks: Task[]) =>
  [...tasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

export const getUpcomingTasks = (tasks: Task[], days = 7) =>
  sortTasksByDate(tasks.filter((task) => !task.completed && isWithinDays(task.dueDate, days)));

export const getUpcomingExams = (tasks: Task[], days = 7) =>
  getUpcomingTasks(tasks, days).filter((task) => task.type === "exam");
