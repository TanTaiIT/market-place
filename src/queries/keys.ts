export const qk = {
  listings: (cat: string) => ['listings', cat] as const,
  listing: (id: number) => ['listing', id] as const,
  search: (q: string) => ['search', q] as const,
  myListings: () => ['listings', 'mine'] as const,
  savedIds: () => ['saved', 'ids'] as const,
  savedListings: () => ['saved', 'listings'] as const,
  conversations: () => ['conversations'] as const,
  conversation: (id: number) => ['conversation', id] as const,
  notifications: () => ['notifications'] as const,
  profile: () => ['profile'] as const,
};
