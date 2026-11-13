export interface Moved {
  /** The old address, e.g. /strategy/99. */
  from: string;
  /** The page it goes to, on this site. */
  to: string;
  label: string;
}

export const LIST_PATH: string;
export const MAX_MOVED: number;
export const WARN_MOVED: number;

export function movedList(
  rows: Array<{ id: string; slug: string; display_number: number | null; title: string; asset: string }>,
): Moved[];
export function readMoved(storeUrl: string, key: string): Promise<Moved[]>;
export function movedKey(list: Array<Pick<Moved, "from" | "to">>): string;
