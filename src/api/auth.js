/**
 * Auth API stub (Supabase Auth или аналог — при реализации).
 *
 * @typedef {{ userId: string; email: string }} AuthUser
 * @typedef {{ user: AuthUser }} AuthSession
 */

/**
 * @param {{ email: string; password: string; name?: string }} _input
 * @returns {Promise<AuthSession>}
 */
export async function signUp(_input) {
  throw new Error("auth.signUp: not implemented");
}

/**
 * @param {{ email: string; password: string }} _input
 * @returns {Promise<AuthSession>}
 */
export async function signIn(_input) {
  throw new Error("auth.signIn: not implemented");
}

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  throw new Error("auth.signOut: not implemented");
}
