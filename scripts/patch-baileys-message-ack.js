import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Baileys 6.7.20+ omitted the required stream acknowledgement after a message
// was decrypted successfully. WhatsApp later terminates the connection with
// `Stream Errored (ack)`, then replays the same message on reconnect. Keep this
// small compatibility patch until the project can move to a verified 7.x fix.
//
// The second patch acknowledges a message whose handling throws (for example a
// stale Signal session or a failed receipt). Baileys only logs that error, so
// the message was never acknowledged and WhatsApp closed the stream the same way.
const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '..', 'node_modules', '@whiskeysockets', 'baileys');
const target = resolve(packageDir, 'lib', 'Socket', 'messages-recv.js');
const marker = resolve(packageDir, '.buysell-message-ack-patched');

const patches = [
  {
    name: 'acknowledge decrypted messages',
    before: "cleanMessage(msg, authState.creds.me.id);\n                    await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');",
    after: "cleanMessage(msg, authState.creds.me.id);\n                    await sendMessageAck(node);\n                    node.buysellAcked = true;\n                    await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');",
    // Installs patched by the first version of this script lack only the flag.
    upgradeFrom: "cleanMessage(msg, authState.creds.me.id);\n                    await sendMessageAck(node);\n                    await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');",
  },
  {
    name: 'acknowledge messages whose handling failed',
    before: "        catch (error) {\n            logger.error({ error, node }, 'error in handling message');\n        }",
    after: "        catch (error) {\n            logger.error({ error, node }, 'error in handling message');\n            if (!node.buysellAcked) {\n                await sendMessageAck(node).catch(() => { });\n            }\n        }",
  },
];

if (!existsSync(target)) {
  console.warn('[postinstall] Baileys acknowledgement patch skipped: messages-recv.js was not found.');
  process.exit(0);
}

let source = readFileSync(target, 'utf8');
for (const patch of patches) {
  if (source.includes(patch.after)) continue;
  if (patch.upgradeFrom && source.includes(patch.upgradeFrom)) {
    source = source.replace(patch.upgradeFrom, () => patch.after);
    continue;
  }
  if (!source.includes(patch.before)) {
    console.error(`[postinstall] Baileys patch "${patch.name}" could not be applied: installed source does not match the supported release.`);
    process.exit(1);
  }
  source = source.replace(patch.before, () => patch.after);
}

writeFileSync(target, source, 'utf8');
writeFileSync(marker, 'BUYSELL Baileys message acknowledgement patch applied\n', 'utf8');
console.info('[postinstall] Restored Baileys acknowledgement for decrypted and failed messages.');
