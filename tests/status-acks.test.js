import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { acknowledgeStatusUpdates } from '../status-acks.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

function fakeSocket(sendMessageAck) {
  return { ws: new EventEmitter(), sendMessageAck };
}

test('a <status> stanza from WhatsApp is acknowledged', async () => {
  const acked = [];
  const sock = fakeSocket(async node => { acked.push(node); });
  acknowledgeStatusUpdates(sock);

  const node = { tag: 'status', attrs: { id: 'AC3069E7D78945246C3120CEA05B9EA5', from: '2348000000000@s.whatsapp.net', type: 'reaction' } };
  // Baileys emits each incoming stanza as `CB:<tag>`; true means a listener took it.
  assert.equal(sock.ws.emit('CB:status', node), true);
  await settle();
  assert.deepEqual(acked, [node]);
});

test('a failed acknowledgement is logged, never thrown into Baileys', async () => {
  const sock = fakeSocket(() => { throw new Error('socket closed'); });
  acknowledgeStatusUpdates(sock);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    assert.doesNotThrow(() => sock.ws.emit('CB:status', { tag: 'status', attrs: { id: 'X', from: 'a@s.whatsapp.net' } }));
    await settle();
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Could not acknowledge a WhatsApp status update: socket closed/);
});
