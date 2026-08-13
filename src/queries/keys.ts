export const qk = {
  /** Cũng là prefix của `myListings()` — invalidate key này là quét cả hai. */
  listings: () => ['listings'] as const,
  myListings: () => ['listings', 'mine'] as const,
  listing: (id: string) => ['listing', id] as const,
  search: (q: string) => ['search', q] as const,
  /** Prefix thuần: không query nào dùng trực tiếp, chỉ để invalidate cả cụm `saved`. */
  savedRoot: () => ['saved'] as const,
  savedIds: () => ['saved', 'ids'] as const,
  savedListings: () => ['saved', 'listings'] as const,
  conversations: () => ['conversations'] as const,
  conversation: (id: number) => ['conversation', id] as const,
  notifications: () => ['notifications'] as const,
  profile: () => ['profile'] as const,
};
