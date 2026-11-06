import { useSessionStore } from '../store/sessionStore'
import { SCANNER_DESK, deskInfo } from './desks'

/**
 * What the signed-in user can do, from the server: `capabilities` and `staffDesks` (one per
 * admin role assigned under Admin users). Platform admins get every wireframe desk; everyone
 * else only sees the desks that match their assigned roles.
 */
export function rolesFrom(capabilities, staffDesks = []) {
  const caps = capabilities ?? {}
  const canScan = Boolean(caps.scanner)
  const desks = staffDesks.length ? staffDesks : canScan ? [SCANNER_DESK] : []
  const isStaff = desks.length > 0
  const canViewPeople = Boolean(caps.people_all || caps.people_approved)
  // Accounts with no flags at all (older sessions) are treated as delegates.
  const isParticipant = Boolean(caps.participant) || !isStaff
  const canSwitchDesks = desks.length > 1

  return {
    isParticipant,
    isStaff,
    canScan,
    canViewPeople,
    canViewAllPeople: Boolean(caps.people_all),
    canViewGroups: Boolean(caps.groups),
    desks,
    canSwitchDesks,
  }
}

export function useRoles() {
  const capabilities = useSessionStore((state) => state.capabilities)
  const staffDesks = useSessionStore((state) => state.staffDesks)
  return rolesFrom(capabilities, staffDesks ?? [])
}

/**
 * The desk the staff app shows. Prefers the user's chosen deskKey, then their own role,
 * then the first desk from the server (wireframe order for admins).
 */
export function useDesk() {
  const { desks } = useRoles()
  const deskKey = useSessionStore((state) => state.deskKey)
  const chosen = desks.find((entry) => entry.key === deskKey)
  const own = desks.find((entry) => entry.own)
  const desk = chosen ?? own ?? desks[0] ?? null
  return desk ? { ...desk, ...deskInfo(desk.key) } : null
}

/** Whether the user holds both delegate and staff roles, so they choose which app to open. */
export function hasBothRoles(capabilities, staffDesks = []) {
  const roles = rolesFrom(capabilities, staffDesks)
  return roles.isParticipant && roles.isStaff
}

/** Landing screen: the delegate home, the staff desk, or (for users with both) their chosen app or the chooser. */
export function homeScreenFor(capabilities, staffDesks = [], mode = null) {
  if (hasBothRoles(capabilities, staffDesks)) {
    if (mode === 'delegate') return 'home'
    if (mode === 'staff') return 'shome'
    return 'choose'
  }
  return rolesFrom(capabilities, staffDesks).isParticipant ? 'home' : 'shome'
}
