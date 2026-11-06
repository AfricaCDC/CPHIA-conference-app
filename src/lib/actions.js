/**
 * Everything the delegate has to act on, gathered from their registration, travel and finance file and
 * unread messages. Each item says which module it belongs to, so the module card can show a bell.
 */
export function buildActions({ registration, logistics, updates = 0, chats = 0 }) {
  const items = []
  const add = (item) => items.push({ module: 'general', ...item })

  // Accommodation first so hotel to-dos lead the action centre.
  const hotel = registration?.hotel_assignment
  if (hotel && !hotel.assignment_confirmed) {
    add({ key: 'hotel', module: 'accommodation', screen: 'accommodation', title: 'Confirm your hotel booking', detail: hotel.hotel_name })
  } else if (
    registration
    && registration.hotel_covered === false
    && !registration.staying_hotel_name
    && !registration.hotel_preference_id
    && !registration.hotel_preference_name
  ) {
    add({
      key: 'hotel-stay',
      module: 'accommodation',
      screen: 'accommodation',
      title: 'Tell us where you are staying',
      detail: 'So the shuttle team can plan your hotel pickup',
    })
  }

  const ticket = registration?.ticket_document
  if (ticket && !ticket.receipt_confirmed_at) {
    add({ key: 'ticket', module: 'travel', screen: 'travel', title: 'Confirm you received your ticket', detail: [ticket.airline_name, ticket.flight_number].filter(Boolean).join(' · ') || ticket.document_name })
  }
  for (const option of (logistics?.itineraries ?? []).filter((o) => o.is_open)) {
    add({ key: `flight-${option.id}`, module: 'travel', screen: 'travel', title: 'Choose your flight', detail: `${option.airline_name ?? 'Flight option'} · accept or decline with a reason` })
  }
  const letter = registration?.invitation_letter
  if (letter && !letter.visa_profile_complete && !letter.visa_profile_locked) {
    add({ key: 'visa', module: 'visa', screen: 'visa', title: 'Add your passport and visa details', detail: 'Needed for your invitation letter and visa' })
  }
  if (logistics?.bank_details_required) {
    add({ key: 'bank', module: 'finance', screen: 'finance', title: 'Add your bank details for DSA', detail: 'Needed before your DSA can be paid' })
  }
  const dsa = logistics?.dsa
  if (dsa && ['paid', 'confirmed', 'closed'].includes(dsa.status) && !dsa.receipt_confirmed) {
    add({ key: 'dsa-receipt', module: 'finance', screen: 'finance', title: 'Confirm you received your DSA', detail: dsa.amount != null ? `${dsa.currency ?? ''} ${Number(dsa.amount).toFixed(2)}`.trim() : null })
  }
  const docs = logistics?.dsa_documents
  if (logistics?.dsa_covered && docs) {
    if (!docs.has_boarding_pass) add({ key: 'boarding', module: 'finance', screen: 'finance', title: 'Upload your boarding pass', detail: 'Needed before DSA can be paid' })
    if (!docs.has_claim) add({ key: 'claim', module: 'finance', screen: 'finance', title: 'Upload your travel claim', detail: 'Finance checks it before payment' })
    if (docs.requires_ticket && !docs.has_ticket) add({ key: 'ticket-doc', module: 'finance', screen: 'finance', title: 'Upload your ticket for DSA', detail: 'Finance needs a copy' })
  }
  for (const request of logistics?.info_requests ?? []) {
    add({ key: `info-${request.id}`, module: 'finance', screen: 'finance', title: `${request.requested_by_partner ?? 'The desk'} needs more information`, detail: request.fields?.map((f) => f.label).join(', ') || request.message })
  }
  if (chats > 0) add({ key: 'chats', module: 'messages', screen: 'messages', params: { tab: 'chats' }, title: `${chats} unread chat message${chats === 1 ? '' : 's'}`, detail: 'From other delegates' })
  if ((logistics?.unread_messages ?? 0) > 0) add({ key: 'desk-msgs', module: 'messages', screen: 'messages', params: { tab: 'desks' }, title: `${logistics.unread_messages} new message${logistics.unread_messages === 1 ? '' : 's'} from the desks`, detail: 'Travel & Finance' })
  if (updates > 0) add({ key: 'updates', module: 'messages', screen: 'messages', params: { tab: 'updates' }, title: `${updates} new update${updates === 1 ? '' : 's'}`, detail: 'From the travel, hotel, badge and transport desks' })

  return items
}

/** Count of items per screen, so each module card can show its bell. */
export function countsByScreen(items) {
  return items.reduce((counts, item) => ({ ...counts, [item.screen]: (counts[item.screen] ?? 0) + 1 }), {})
}

export const MODULE_LABEL = { travel: 'Travel', accommodation: 'Accommodation', visa: 'Visa', finance: 'Finance', messages: 'Messages', general: 'Other' }
