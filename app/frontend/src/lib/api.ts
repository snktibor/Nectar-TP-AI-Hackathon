const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

function fallbackApiBase(): string {
  const runtimeWindow = globalThis.window
  if (!runtimeWindow) {
    return 'http://127.0.0.1:8000'
  }

  return `${runtimeWindow.location.protocol}//${runtimeWindow.location.hostname}:8000`
}

export const API_BASE_URL = configuredApiBase || fallbackApiBase()

export function toApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function isNetworkFetchError(error: Error): boolean {
  const normalized = error.message.toLowerCase()
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  )
}

export function toUserFacingApiError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && isNetworkFetchError(error)) {
    return 'Kapcsolati hiba történt. Kérlek próbáld újra néhány másodperc múlva.'
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}
