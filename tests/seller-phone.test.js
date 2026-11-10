import assert from 'node:assert/strict';
import test from 'node:test';
import { SellerPhones, phoneFromJid, usablePhone } from '../seller-phone.js';

const PRIVATE_ID = '185091716292711@lid';
const quiet = { warn() {} };

test('only phone-number IDs give a number; private IDs never do', () => {
  assert.equal(phoneFromJid('2348031234567@s.whatsapp.net'), '2348031234567');
  assert.equal(phoneFromJid('2348031234567:12@s.whatsapp.net'), '2348031234567');
  assert.equal(phoneFromJid(PRIVATE_ID), null);
  assert.equal(phoneFromJid('120363405967163832@g.us'), null);
  assert.equal(phoneFromJid(undefined), null);
});

test('a saved number is ignored when it is just the private ID\'s digits', () => {
  assert.equal(usablePhone('185091716292711', PRIVATE_ID), null);
  assert.equal(usablePhone('2348031234567', PRIVATE_ID), '2348031234567');
  assert.equal(usablePhone('0803 123 4567', PRIVATE_ID), '08031234567');
  assert.equal(usablePhone('12345', PRIVATE_ID), null);
  assert.equal(usablePhone(null, PRIVATE_ID), null);
});

test('a group message carrying the sender\'s real number is remembered', () => {
  const phones = new SellerPhones({ log: quiet });
  phones.rememberMessage({ key: { participant: PRIVATE_ID, participantPn: '2348031234567@s.whatsapp.net' } }, PRIVATE_ID);
  assert.equal(phones.known(PRIVATE_ID), '2348031234567');
  phones.rememberMessage({ key: { participant: '2348000000000@s.whatsapp.net' } }, '2348000000000@s.whatsapp.net');
  assert.equal(phones.byPrivateId.size, 1);
});

test('group member lists in each Baileys shape are understood; hidden numbers are skipped', () => {
  const phones = new SellerPhones({ log: quiet });
  phones.rememberMembers([
    { id: '111@lid', jid: '2348011111111@s.whatsapp.net', lid: '111@lid' },
    { id: '2348022222222@s.whatsapp.net', jid: '2348022222222@s.whatsapp.net', lid: '222@lid' },
    { id: '333@lid', lid: '333@lid' },
  ]);
  assert.equal(phones.known('111@lid'), '2348011111111');
  assert.equal(phones.known('222@lid'), '2348022222222');
  assert.equal(phones.known('333@lid'), null);
});

test('lookup reads the group\'s members once, then answers from memory', async () => {
  let reads = 0;
  let clock = 0;
  const sock = { groupMetadata: async () => { reads += 1; return { participants: [{ id: PRIVATE_ID, jid: '2348031234567@s.whatsapp.net' }] }; } };
  const phones = new SellerPhones({ log: quiet, now: () => clock });
  assert.equal(await phones.lookup(sock, 'g1@g.us', PRIVATE_ID), '2348031234567');
  assert.equal(await phones.lookup(sock, 'g1@g.us', PRIVATE_ID), '2348031234567');
  assert.equal(reads, 1);
  assert.equal(await phones.lookup(sock, 'g1@g.us', '2348099999999@s.whatsapp.net'), '2348099999999');
  assert.equal(reads, 1, 'a phone-number sender needs no lookup');
});

test('a hidden number is null, and the group is not asked again until the wait is over', async () => {
  let reads = 0;
  let clock = 0;
  const sock = { groupMetadata: async () => { reads += 1; return { participants: [{ id: PRIVATE_ID, lid: PRIVATE_ID }] }; } };
  const phones = new SellerPhones({ log: quiet, now: () => clock, refreshMs: 600_000 });
  assert.equal(await phones.lookup(sock, 'g1@g.us', PRIVATE_ID), null);
  clock = 60_000;
  assert.equal(await phones.lookup(sock, 'g1@g.us', PRIVATE_ID), null);
  assert.equal(reads, 1);
  clock = 600_000;
  await phones.lookup(sock, 'g1@g.us', PRIVATE_ID);
  assert.equal(reads, 2);
});

test('a failing member list read does not break the lookup', async () => {
  const sock = { groupMetadata: async () => { throw new Error('rate-overlimit'); } };
  const phones = new SellerPhones({ log: quiet });
  assert.equal(await phones.lookup(sock, 'g1@g.us', PRIVATE_ID), null);
  assert.equal(await phones.lookup(null, 'g1@g.us', PRIVATE_ID), null);
});
