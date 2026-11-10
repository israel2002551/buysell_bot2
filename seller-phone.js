// WhatsApp names many group members by a private ID (…@lid) instead of their
// phone number, and those digits are not a number anyone can call or message.
// A member's real number comes with their messages (participantPn) or from the
// group's member list, when the group shows numbers to its members.

const PHONE_JID = /@(s\.whatsapp\.net|c\.us)$/;

// "2348012345678@s.whatsapp.net" (also with a ":device" part) -> "2348012345678".
export function phoneFromJid(jid) {
  const text = String(jid || '');
  if (!PHONE_JID.test(text)) return null;
  const digits = text.split('@')[0].split(':')[0].replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function isPrivateId(jid) {
  return String(jid || '').endsWith('@lid');
}

// A saved number, unless it is only the digits of the sender's private ID
// (older listings and queue jobs saved those by mistake).
export function usablePhone(phone, senderJid) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (isPrivateId(senderJid) && digits === String(senderJid).split('@')[0].replace(/\D/g, '')) return null;
  return digits;
}

// Remembers the real numbers behind private IDs, and looks them up in group
// member lists when needed (at most once every refreshMs per group).
export class SellerPhones {
  constructor({ refreshMs = 10 * 60_000, now = () => Date.now(), log = console } = {}) {
    this.byPrivateId = new Map();
    this.membersReadAt = new Map();
    this.refreshMs = refreshMs;
    this.now = now;
    this.log = log;
  }

  // A group message can carry the real number of a sender it names by private ID.
  rememberMessage(message, senderJid) {
    const phone = phoneFromJid(message?.key?.participantPn);
    if (phone && isPrivateId(senderJid)) this.byPrivateId.set(senderJid, phone);
  }

  // Baileys group members look like { id, jid?, lid? }; jid is their number when WhatsApp shows it.
  rememberMembers(participants) {
    for (const member of Array.isArray(participants) ? participants : []) {
      const privateId = [member?.lid, member?.id].find(isPrivateId);
      const phone = phoneFromJid(member?.jid) || phoneFromJid(member?.id);
      if (privateId && phone) this.byPrivateId.set(privateId, phone);
    }
  }

  known(privateId) {
    return this.byPrivateId.get(privateId) || null;
  }

  // The sender's real number, or null when WhatsApp hides it.
  async lookup(sock, groupJid, senderJid) {
    const own = phoneFromJid(senderJid);
    if (own) return own;
    if (!isPrivateId(senderJid)) return null;
    if (!this.byPrivateId.has(senderJid) && typeof sock?.groupMetadata === 'function' && groupJid) {
      const readAt = this.membersReadAt.get(groupJid);
      if (readAt === undefined || this.now() - readAt >= this.refreshMs) {
        this.membersReadAt.set(groupJid, this.now());
        try {
          this.rememberMembers((await sock.groupMetadata(groupJid))?.participants);
        } catch (error) {
          this.log.warn?.(`[Seller phone] Could not read the members of ${groupJid}: ${error?.message || error}`);
        }
      }
    }
    return this.known(senderJid);
  }
}
