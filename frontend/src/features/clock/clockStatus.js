// Who is held at the clock-in screen: staff who are not on the clock, and nobody else. Admins
// are exempt, matching the server, which compares the role exactly. No person at all counts
// as held, so a missing user can never slip through.
export function isGated(user) {
  if (!user) {
    return true
  }

  return user.role !== 'admin' && user.clocked_in !== true
}

// Staff are logged out when they clock out. Clocking out would put them behind the clock-in
// screen, where the next person to pick up a shared tablet would see their name and could
// clock in as them. Admins are exempt from that screen, so they stay logged in.
export function logsOutOnClockOut(user) {
  return isGated({ ...user, clocked_in: false })
}