import Cookies from 'js-cookie'

const TokenKey = 'vue_admin_template_token'

export function getToken() {
  return Cookies.get(TokenKey)
}

export function setToken(token) {
  return Cookies.set(TokenKey, token)
}

export function removeToken() {
  return Cookies.remove(TokenKey)
}
// ---------------- //

const firebaseId = 'firebase-id'

export function getuid() {
  return Cookies.get(firebaseId)
}

export function setuid(token) {
  return Cookies.set(firebaseId, token)
}

export function removeuid() {
  return Cookies.remove(firebaseId)
}
