/**
 * Shared subscription store
 * WARNING: Demo-only in-memory store. Replace with DB in production.
 */

export const subscriptions: unknown[] = [];

export function addSubscription(subscription: unknown): void {
  subscriptions.push(subscription);
}

export function getSubscriptions(): unknown[] {
  return subscriptions;
}

export function getSubscriptionCount(): number {
  return subscriptions.length;
}
