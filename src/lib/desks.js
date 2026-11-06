/**
 * Staff desks from the mobile wireframe. The server sends the user's desks (one per admin role,
 * `staff_desks` on /auth/me); this adds what each desk shows on the phone.
 *
 * tab: the desk's own fourth tab. kind "venue" and "groups" show live lists in the app; the
 * other queues (PRs, DSA files, tickets, rooms, arrivals, fleet) open the desk in the Event
 * Management Center, where the full queue lives.
 */
const TAB = {
  groups: { label: 'Groups', kind: 'groups', icon: 'queue' },
  students: { label: 'Students', kind: 'groups', icon: 'queue' },
  youth: { label: 'Youth', kind: 'groups', icon: 'queue' },
  venue: { label: 'Venue', kind: 'venue', icon: 'map' },
  prs: { label: 'All PRs', kind: 'web', icon: 'queue' },
  approvals: { label: 'Approvals', kind: 'web', icon: 'queue' },
  files: { label: 'DSA files', kind: 'web', icon: 'queue' },
  tickets: { label: 'Tickets', kind: 'web', icon: 'queue' },
  rooms: { label: 'Rooms', kind: 'web', icon: 'map' },
  fleet: { label: 'Fleet', kind: 'web', icon: 'bus' },
  dispatch: { label: 'Rides today', kind: 'dispatch', icon: 'bus' },
  shuttleBay: { label: 'Shuttle bay', kind: 'transport', desk: 'venue', icon: 'bus' },
  hotelGuests: { label: 'Guests', kind: 'transport', desk: 'hotel', icon: 'queue' },
  parking: { label: 'Parking', kind: 'transport', desk: 'parking', icon: 'bus' },
  carGate: { label: 'Cars at gate', kind: 'transport', desk: 'car', icon: 'bus' },
  movements: { label: 'Movements', kind: 'movements', icon: 'queue' },
}

const DEFAULT_SCAN = 'Opens the participant’s record for your desk.'

export const DESKS = {
  reg_admin: { kicker: 'Registration admin', title: 'Participants desk', tab: TAB.groups, find: true, about: 'Find and check participants, register walk-ins and follow sponsored people without a group. Bulk actions stay on the desktop.' },
  group_mgr: { kicker: 'Group manager', title: 'My group', tab: TAB.groups, about: 'See who is attending in your group and their progress. Status is read-only; the teams do the follow-up.' },
  badge: { kicker: 'Badge desk', title: 'Print and reprint', tab: TAB.venue, scan: true, find: true, scanHelp: 'Shows the badge record and checks the delegate in.', about: 'Scan the delegate’s QR to find their badge (packing list and box), check them in and hand it over. Walk-in with no QR: search by name, verify ID.' },
  pr_asst: { kicker: 'PR assistant', title: 'PR creation', tab: TAB.prs, about: 'Create purchase requisitions and re-submit returned ones. Releases are done by the DDG, Finance and the Admin Director.' },
  ddg: { kicker: 'DDG · 1st release', title: 'Executive dashboard', tab: TAB.prs, about: 'Release PRs to Finance or return them with a reason. Aggregates only; no personal data on the executive strip.' },
  adir: { kicker: 'Admin Director · final', title: 'PR final release', tab: TAB.prs, about: 'Final release sends the PR to the travel team.' },
  fin_mgr: { kicker: 'Finance manager', title: 'Action centre', tab: TAB.files, about: 'Assign complete DSA files to officers, set the DSA rule, confirm money received and do the PR second release.' },
  fin_asst: { kicker: 'Finance assistant', title: 'DSA file checks', tab: TAB.files, about: 'Check bank details, boarding passes and travel claims, mark files complete or request information.' },
  fin_off: { kicker: 'Finance officer', title: 'My DSA files', tab: TAB.files, about: 'Pay the DSA files assigned to you and confirm payment. You see only your own files.' },
  trv_mgr: { kicker: 'Travel manager', title: 'Travel dashboard', tab: TAB.tickets, about: 'Assign released PRs to officers and agents, and answer participant messages.' },
  trv_off: { kicker: 'Travel officer · agent', title: 'My assignments', tab: TAB.tickets, about: 'Send itineraries and upload tickets. The participant confirms the itinerary and receipt in their app.' },
  acc_mgr: { kicker: 'Accommodation manager', title: 'Dashboard', tab: TAB.rooms, about: 'Assign eligible people to hotel assistants, release rooms and run hotel reports.' },
  hot_asst: { kicker: 'Hotel assistant', title: 'My accommodation', tab: TAB.rooms, about: 'Place people in hotels and rooms and send bookings to the hotel.' },
  hotel: { kicker: 'Hotel', title: 'Rooming list', tab: TAB.rooms, scan: true, scanHelp: 'Opens the guest’s booking for check-in.', about: 'Your rooming list: check guests in and record no-shows.' },
  prot_mgr: { kicker: 'Protocol manager', title: 'VIP and airport', tab: TAB.movements, about: 'Cover airport shifts, assign officers and follow note verbale batches and movement orders.' },
  prot_off: { kicker: 'Protocol officer · my shift', title: 'My shift', tab: TAB.movements, scan: true, scanHelp: 'Opens the arrival record and NV number.', about: 'Meet arriving delegates, take the ones that need support and mark visas cleared. Covers every protocol role from the Event Management Center.' },
  room_focal: { kicker: 'Room focal point', title: 'My room today', tab: TAB.venue, find: true, about: 'Sessions and rooms for the venue team: requirements, speaker checklist and live boards. Covers venue, programme, scientific, poster, side-event and exhibition roles.' },
  room_usher: { kicker: 'Room usher', title: 'Door and seats', tab: TAB.venue, scan: true, scanHelp: 'Admits to the room and counts the seat; refuses if not registered.', about: 'Scan badges at the door, count seats and flag a full room.' },
  hall_usher: { kicker: 'Hall usher', title: 'Flow and queues', tab: TAB.venue, scan: true, scanHelp: 'Checks the badge and directs to the right room.', about: 'Watch room occupancy and queues on your floor, open overflow rooms and call security.' },
  poster: { kicker: 'Poster team', title: 'Boards and sessions', tab: TAB.venue, about: 'Assign poster boards and run the poster sessions.' },
  scientific: { kicker: 'Scientific team', title: 'Oral abstracts', tab: TAB.venue, about: 'Place accepted oral abstracts in sessions and rooms, and follow reviews.' },
  prog: { kicker: 'Programme team', title: 'Sessions and speakers', tab: TAB.venue, about: 'Fix unplaced sessions and room changes, then publish them to the participant app.' },
  side: { kicker: 'Side-event team', title: 'Applications and rooms', tab: TAB.venue, about: 'Place side events in rooms, lock paid ones and see attendee lists.' },
  exhib: { kicker: 'Exhibition team', title: 'Booths', tab: TAB.venue, about: 'Allocate booths and follow holds.' },
  transport_mgr: { kicker: 'Transport manager', title: 'Command centre', tab: TAB.fleet, about: 'Waiting signals, ride requests and the fleet. Dispatch cars and publish the shuttle timetable.' },
  dispatch: { kicker: 'Dispatch officer', title: 'Rides today', tab: TAB.dispatch, about: 'See who is waiting at each stop and the ride requests. Assign a free car and driver to a request.' },
  fleet: { kicker: 'Fleet coordinator', title: 'Vehicles and drivers', tab: TAB.fleet, about: 'Vehicles, drivers and GPS tags.' },
  vendor: { kicker: 'Transport vendor', title: 'My vehicles', tab: TAB.fleet, about: 'Your own vehicles and shifts only.' },
  venue_usher: { kicker: 'Venue transport usher', title: 'Shuttle bay', tab: TAB.shuttleBay, about: 'Buses at the bay, people waiting, departures. Request an extra bus from dispatch.' },
  car_usher: { kicker: 'Car usher · VIP drop-off', title: 'Arrivals at the gate', tab: TAB.carGate, about: 'Expected VIP cars, arrivals at the gate and the holding area.' },
  parking_usher: { kicker: 'Parking usher', title: 'Lots and passes', tab: TAB.parking, scan: true, scanHelp: 'Validates the parking pass and lot.', about: 'Parking lots, VIP reserved spaces and passes.' },
  hotel_usher: { kicker: 'Hotel desk usher', title: 'CPHIA desk in the lobby', tab: TAB.hotelGuests, scan: true, find: true, scanHelp: 'Opens the guest’s booking for Africa CDC check-in.', about: 'Confirm check-in for Africa CDC–sponsored guests staying in hotels marked Used by Africa CDC. Accommodation managers and admins can switch hotel.' },
  security: { kicker: 'Security (onsite)', title: 'Access control', tab: TAB.venue, scan: true, scanHelp: 'Checks the badge at the gate and flags a blocked badge.', about: 'Scan badges at the gate, clear queues and log incidents.' },
  student_admin: { kicker: 'Student admin', title: 'Student verifications', tab: TAB.students, about: 'Review uploaded student IDs, approve or request information.' },
  youth_admin: { kicker: 'Youth admin', title: 'Youth pipeline', tab: TAB.youth, about: 'Youth applicants, sponsorships and invitations.' },
  approvals: { kicker: 'Approvals officer', title: 'My inbox', tab: TAB.approvals, about: 'Approve or return requests with a reason.' },
  partner: { kicker: 'Partner desk', title: 'My participants', tab: TAB.tickets, about: 'Partners see only their own participants: itineraries, released rooms and DSA.' },
  checkin: { kicker: 'Accreditation', title: 'Check-in desk', tab: TAB.venue, scan: true, find: true, scanHelp: 'Shows the delegate and checks them in.', about: 'Scan badges and check delegates in at the entrance.' },
}

// Staff with the attendance scanner but no admin desk (e.g. a check-in volunteer).
export const SCANNER_DESK = { key: 'checkin', label: 'Accreditation & check-in', web_url: null }

export function deskInfo(key) {
  return DESKS[key] ?? { kicker: 'Staff', title: 'My desk', tab: TAB.venue, about: '' }
}

export function scanHelp(key) {
  return deskInfo(key).scanHelp ?? DEFAULT_SCAN
}
