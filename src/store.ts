import { User } from "./types";
import { generateUUID } from "./lib/utils";

export const USER_STORAGE_KEY = "syncwatch_user";
export const RECENT_ROOMS_KEY = "syncwatch_recent_rooms";

export function getUser(): User | null {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function saveUser(name: string): User {
  const existing = getUser();
  const user: User = {
    id: existing?.id || generateUUID(),
    name,
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function getRecentRooms(): string[] {
  try {
    const data = localStorage.getItem(RECENT_ROOMS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  return [];
}

export function addRecentRoom(roomId: string) {
  const rooms = getRecentRooms();
  const newRooms = [roomId, ...rooms.filter(id => id !== roomId)].slice(0, 10);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(newRooms));
}

export function resetIdentity() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(RECENT_ROOMS_KEY);
}
