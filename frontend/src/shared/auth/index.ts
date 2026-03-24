const AUTH_KEY = 'anpr_auth'

export function getAuthHeader(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function setCredentials(username: string, password: string): void {
  localStorage.setItem(AUTH_KEY, `Basic ${btoa(`${username}:${password}`)}`)
}

export function clearCredentials(): void {
  localStorage.removeItem(AUTH_KEY)
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(AUTH_KEY)
}
