// Who is held at the clock-in screen: staff who are not on the clock, and nobody else. Admins
// are exempt, matching the server, which compares the role exactly. No person at all counts
// as held, so a missing user can never slip through.
export function isGated(user) {
  if (!user) {
    return true
  }

  return user.role !== 'admin' && user.clocked_in !== true
}