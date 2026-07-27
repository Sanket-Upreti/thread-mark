import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv, findEnvFile } from '../src/loadEnv.js';

describe('parseEnv', () => {
  it('reads a plain assignment', () => {
    expect(parseEnv('SLACK_USER_TOKEN=xoxp-abc')).toEqual({ SLACK_USER_TOKEN: 'xoxp-abc' });
  });

  it('ignores comments and blank lines', () => {
    expect(parseEnv('# a comment\n\nA=1\n')).toEqual({ A: '1' });
  });

  it('strips an export prefix', () => {
    expect(parseEnv('export A=1')).toEqual({ A: '1' });
  });

  it('strips double quotes and unescapes', () => {
    expect(parseEnv('A="one\\ntwo"')).toEqual({ A: 'one\ntwo' });
  });

  it('treats single quotes as literal', () => {
    expect(parseEnv("A='one\\ntwo'")).toEqual({ A: 'one\\ntwo' });
  });

  it('drops an inline comment from an unquoted value', () => {
    expect(parseEnv('A=value # trailing')).toEqual({ A: 'value' });
  });

  it('keeps a # that is part of an unquoted value', () => {
    expect(parseEnv('A=va#lue')).toEqual({ A: 'va#lue' });
  });

  it('keeps = characters inside a value', () => {
    expect(parseEnv('A=a=b=c')).toEqual({ A: 'a=b=c' });
  });

  it('skips lines with no =', () => {
    expect(parseEnv('NOT_AN_ASSIGNMENT\nA=1')).toEqual({ A: '1' });
  });

  it('returns nothing for empty input', () => {
    expect(parseEnv('')).toEqual({});
  });
});

describe('findEnvFile', () => {
  it('finds a .env in a parent directory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'thread-mark-'));
    const nested = path.join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(root, '.env'), 'A=1');

    expect(findEnvFile(nested)).toBe(path.join(root, '.env'));
  });

  it('returns undefined when there is no .env anywhere above', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'thread-mark-'));
    // A real .env at the filesystem root would break this, which does not happen in practice.
    expect(findEnvFile(root)).toBeUndefined();
  });
});
