export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Virtual playlist id used for the Favorites collection. */
export const FAVORITES_PLAYLIST_ID = "favorites";
