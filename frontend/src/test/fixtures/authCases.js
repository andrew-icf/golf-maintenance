import { ApiError } from '../../api'

// A person's profile, as /me describes them
export const PROFILE_ON_THE_CLOCK = {
  id: 'user-1',
  full_name: 'Luke Skywalker',
  job_title: 'operator',
  clocked_in: true,
}
export const PROFILE_OFF_THE_CLOCK = { ...PROFILE_ON_THE_CLOCK, clocked_in: false }

// The real login response has no clocked_in or job_title, only /me does
export const LOGIN_RESPONSE = {
  id: 'user-1',
  full_name: 'Luke Skywalker',
  role: 'staff',
  message: 'login successful',
}

// What the server says when nobody is logged in, and when the password is wrong
export const NOT_AUTHENTICATED = new ApiError('not authenticated', 401)
export const WRONG_PASSWORD = new ApiError('invalid email or password', 401)

// Ways a check of who is logged in can fail without the server saying nobody is
export const OTHER_CHECK_FAILURE_CASES = [
  { label: 'a dropped connection', failure: new TypeError('Failed to fetch') },
  { label: 'a server error', failure: new ApiError('internal server error', 500) },
  {
    label: 'a refusal that is not about being logged in',
    failure: new ApiError('forbidden: insufficient permissions', 403),
  },
  { label: 'a plain error', failure: new Error('something broke') },
  { label: 'a failure with nothing in it', failure: undefined },
]