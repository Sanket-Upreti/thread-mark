export interface ParsedPermalink {
  channel: string;
  ts: string;
  threadTs?: string;
}

/**
 * Permalinks encode the timestamp as `p<10-digit-seconds><6-digit-micros>`. Replies also
 * carry `?thread_ts=`, the parent anchor conversations.replies needs.
 */
export function parsePermalink(url: string): ParsedPermalink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }

  const match = parsed.pathname.match(/\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/i);
  if (!match) {
    throw new Error(
      `Not a recognizable Slack permalink: ${url}\n` +
        `Expected something like https://yourteam.slack.com/archives/C0123ABCD/p1234567890123456`
    );
  }

  const [, channel, seconds, micros] = match;
  const ts = `${seconds}.${micros}`;
  const threadTs = parsed.searchParams.get('thread_ts') ?? undefined;

  return { channel, ts, threadTs };
}
