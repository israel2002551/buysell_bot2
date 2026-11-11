// WhatsApp delivers contacts' Status updates, and reactions to them, as
// <status> stanzas. Baileys 6.7.24 has no handler for that stanza, so it was
// never acknowledged and WhatsApp closed the connection with
// "Stream Errored (ack)" (detail: <ack class="status" type="reaction" ...>).
// The bot does not use Status updates; it only acknowledges them.
export function acknowledgeStatusUpdates(sock, label = 'Bot 2') {
  sock.ws.on('CB:status', (node) => {
    Promise.resolve()
      .then(() => sock.sendMessageAck(node))
      .catch((error) => console.warn(`[${label}] Could not acknowledge a WhatsApp status update:`, error?.message || error));
  });
}
