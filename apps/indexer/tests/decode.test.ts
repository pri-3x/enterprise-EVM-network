import { describe, expect, it } from 'vitest';
import { Interface } from 'ethers';
import { EnterpriseTokenAbi } from '@besu-net/shared';
import { decodeLog, methodName } from '../src/decode.js';

const iface = new Interface(EnterpriseTokenAbi);
const TOKEN = '0xa50a51c09a5c451c52bb714527e1974b686d8e77';

describe('decodeLog', () => {
  it('decodes an ERC-20 Transfer for the configured token', () => {
    const encoded = iface.encodeEventLog(iface.getEvent('Transfer')!, [
      '0x0000000000000000000000000000000000000000',
      '0xfe3b557e8fb62b89f4916b721be55ceb828dbd73',
      1000n,
    ]);
    const decoded = decodeLog(TOKEN, [...encoded.topics], encoded.data, { token: TOKEN });
    expect(decoded?.name).toBe('Transfer');
    expect(decoded?.args.value).toBe('1000');
    expect(String(decoded?.args.to).toLowerCase()).toBe('0xfe3b557e8fb62b89f4916b721be55ceb828dbd73');
  });

  it('ignores logs from unrelated contracts', () => {
    const encoded = iface.encodeEventLog(iface.getEvent('Transfer')!, [
      '0x0000000000000000000000000000000000000000',
      '0xfe3b557e8fb62b89f4916b721be55ceb828dbd73',
      1n,
    ]);
    expect(decodeLog('0x1111111111111111111111111111111111111111', [...encoded.topics], encoded.data, { token: TOKEN })).toBeNull();
  });
});

describe('methodName', () => {
  it('recognises mint and plain transfers', () => {
    expect(methodName('0x40c10f19' + '00'.repeat(32)).name).toBe('mint');
    expect(methodName('0x').name).toBeNull();
  });
});
