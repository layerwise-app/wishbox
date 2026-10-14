import { createContext, useContext } from 'react';
import type { Project, ProjectRole } from '~/lib/feedback';

export type Viewer = { id: string; name: string; email: string };

type BoardContextValue = {
  project: Project;
  /** The viewer's role on the project's team, or null for everyone else. */
  role: ProjectRole | null;
  viewer: Viewer | null;
  /** Runs the callback now when signed in, or after the visitor signs in. */
  requireUser: (callback: () => void) => void;
  openAuth: () => void;
  openCreate: () => void;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

/** The public board around the current page. Only valid below `/p/$slug`. */
export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error('useBoard must be used inside a public board.');
  return value;
}
