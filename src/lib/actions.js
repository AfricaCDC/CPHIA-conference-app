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

  // After the event: an invitation, not a chore. It leaves the list once they are on the wall.
  if (registration?.wall?.can_join && !registration.wall.joined) {
    add({
      key: 'wall',
      module: 'general',
      screen: 'wall',
      title: 'Add yourself to the CPHIA 2026 wall',
      detail: 'Be listed among the people who attended the 5th International Conference on Public Health in Africa',
    })
  }

  const travel = registration?.travel
  // Only nudge when a ticket benefit requires an itinerary — never the old own-ticket travel plan.
  if (travel && travel.required && !travel.filled) {
    add({
      key: 'travel-details',
      module: 'travel',
      screen: 'travel',
      title: 'Add your travel details',
      detail: 'Needed before your ticket can be booked',
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
  if (dsa?.bank_collection?.state === 'pending_send') {
    const amount = dsa.amount != null ? `${dsa.currency ?? ''} ${Number(dsa.amount).toFixed(2)}`.trim() : null
    add({
      key: 'dsa-pending-bank',
      module: 'finance',
      screen: 'finance',
      title: 'Your DSA is pending bank transfer',
      detail: amount ? `${amount} · waiting to be sent to the bank` : 'Waiting to be sent to the bank',
    })
  }
  if (dsa?.bank_collection?.state === 'ready_at_bank') {
    const bank = dsa.bank_collection.bank_name || dsa.payment_batch?.bank_name
    const serial = dsa.bank_collection.serial_number ?? dsa.payment_batch?.line_number
    add({
      key: 'dsa-collect',
      module: 'finance',
      screen: 'finance',
      title: bank ? `Collect your DSA at ${bank}` : 'Collect your DSA at the assigned bank',
      detail: serial != null ? `Serial #${serial}` : 'Open Finance for your serial number',
    })
  }
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
  if ((logistics?.unread_messages ?? 0) > 0) {
    add({
      key: 'desk-msgs',
      module: 'messages',
      screen: 'messages',
      params: { tab: 'desks', desk: 'travel' },
      title: `${logistics.unread_messages} new message${logistics.unread_messages === 1 ? '' : 's'} from Travel & Finance`,
      detail: 'Ticket, hotel and DSA desks',
    })
  }
  if (updates > 0) add({ key: 'updates', module: 'messages', screen: 'messages', params: { tab: 'updates' }, title: `${updates} new update${updates === 1 ? '' : 's'}`, detail: 'From the travel, hotel, badge and transport desks' })

  return items
}

/** Count of items per screen, so each module card can show its bell. */
export function countsByScreen(items) {
  return items.reduce((counts, item) => ({ ...counts, [item.screen]: (counts[item.screen] ?? 0) + 1 }), {})
}

export const MODULE_LABEL = { travel: 'Travel', accommodation: 'Accommodation', visa: 'Visa', finance: 'Finance', messages: 'Messages', general: 'Other' }
