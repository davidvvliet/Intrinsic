// Registry for pending workspace creation promises
// Allows other parts of the app to wait for a workspace to be created on the backend

const pendingWorkspaces = new Map<string, Promise<void>>();

export function setPending(id: string, promise: Promise<void>) {
  pendingWorkspaces.set(id, promise);
  promise.finally(() => pendingWorkspaces.delete(id));
}

export async function waitForWorkspace(id: string): Promise<void> {
  const pending = pendingWorkspaces.get(id);
  if (pending) await pending;
}
