export interface User {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface VideoState {
  videoUrl?: string;
  currentTime?: number;
  isPlaying?: boolean;
}

export interface RoomData {
  id: string;
  users: User[];
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
}
