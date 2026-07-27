// Slack's API returns machine codes. Say what went wrong and what to do about it.

const EXPLANATIONS: [RegExp, string][] = [
  [
    /invalid_auth|not_authed|token_revoked|account_inactive/,
    'Slack rejected that token. Check it on the Workspaces page — it needs to be a user token starting with xoxp-.',
  ],
  [
    /missing_scope|no_permission/,
    'That token is missing a scope. Reinstall the Slack app with all the scopes listed on the Workspaces page.',
  ],
  [
    /channel_not_found/,
    "Slack can't see that channel with this token. The account it belongs to may not be a member of it.",
  ],
  [/thread_not_found|message_not_found/, 'No message at that link. It may have been deleted.'],
  [/ratelimited/, 'Slack is rate-limiting this token. Wait a moment and convert again.'],
  [
    /fetch|NetworkError|Failed to fetch|ECONNREFUSED/i,
    'Could not reach the thread-mark server. Start it with `npm run web` and try again.',
  ],
];

export function explainError(message: string): string {
  for (const [pattern, explanation] of EXPLANATIONS) {
    if (pattern.test(message)) return explanation;
  }
  return message;
}
