import { api } from './client';
import { PlaceCandidate, SelectedLocation } from '../types';

// A Places "session token" groups autocomplete keystrokes + the final details
// lookup into one billable session. Generate one per picker session.
export function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const locationsApi = {
  autocomplete: (query: string, sessionToken: string) =>
    api.get<{ results: PlaceCandidate[] }>(
      `/locations/autocomplete?q=${encodeURIComponent(query)}&sessiontoken=${sessionToken}`
    ),

  details: (placeId: string, sessionToken: string) =>
    api.get<{ place: SelectedLocation }>(
      `/locations/details?placeId=${encodeURIComponent(placeId)}&sessiontoken=${sessionToken}`
    ),
};
