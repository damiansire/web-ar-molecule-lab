import { describe, it, expect } from 'vitest';
import { isWorkerToMainMessage } from './hands-worker-protocol';

describe('isWorkerToMainMessage', () => {
  it('acepta los 3 tipos válidos', () => {
    expect(isWorkerToMainMessage({ type: 'ready' })).toBe(true);
    expect(isWorkerToMainMessage({ type: 'error', message: 'boom' })).toBe(true);
    expect(isWorkerToMainMessage({ type: 'result', hands: [] })).toBe(true);
  });

  it('rechaza valores sin forma de mensaje', () => {
    expect(isWorkerToMainMessage(null)).toBe(false);
    expect(isWorkerToMainMessage(undefined)).toBe(false);
    expect(isWorkerToMainMessage('ready')).toBe(false);
    expect(isWorkerToMainMessage({})).toBe(false);
    expect(isWorkerToMainMessage({ type: 'frame' })).toBe(false); // es main→worker, no worker→main
    expect(isWorkerToMainMessage({ type: 'unknown' })).toBe(false);
  });
});
