// In-memory session store.
// Each session holds the user's OAuth tokens and basic profile info.
// Sessions survive until the server restarts — sufficient for this use case.

const sessions = new Map();

export function createSession(data) {
  const id = crypto.randomUUID();
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getSession(id) {
  if (!id) return null;
  return sessions.get(id) || null;
}

export function deleteSession(id) {
  if (id) sessions.delete(id);
}
