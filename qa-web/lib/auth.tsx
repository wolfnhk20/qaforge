'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { AuthSession } from '@/types'

const SESSION_STORAGE_KEY = 'qaforge.auth.session'
const PKCE_VERIFIER_KEY = 'qaforge.auth.pkce-verifier'

interface AuthContextValue {
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  signInWithGitHub: () => Promise<void>
  completeOAuth: () => Promise<void>
  signOut: () => Promise<void>
  signInMock: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

function readSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

function persistSession(session: AuthSession | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function isSessionValid(session: AuthSession | null) {
  if (!session) {
    return false
  }

  return session.expires_at * 1000 > Date.now() + 10_000
}

function base64UrlEncode(bytes: Uint8Array) {
  const value = btoa(String.fromCharCode(...bytes))
  return value.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(digest)
}

async function createPkcePair() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64UrlEncode(verifierBytes)
  const challenge = base64UrlEncode(await sha256(verifier))
  return { verifier, challenge }
}

async function exchangeCodeForSession(code: string, verifier: string) {
  const response = await fetch(
    `${getSupabaseUrl()}/auth/v1/token?grant_type=pkce`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: getSupabaseAnonKey(),
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: verifier,
      }),
    },
  )

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || 'GitHub sign-in failed.')
  }

  return payload as AuthSession
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(
    `${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: getSupabaseAnonKey(),
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
  )

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || 'Session refresh failed.')
  }

  return payload as AuthSession
}

async function revokeSession(accessToken: string) {
  await fetch(`${getSupabaseUrl()}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      const cached = readSession()

      if (!cached) {
        setIsLoading(false)
        return
      }

      if (isSessionValid(cached)) {
        setSession(cached)
        setIsLoading(false)
        return
      }

      try {
        const refreshed = await refreshSession(cached.refresh_token)
        if (!refreshed.provider_token && cached.provider_token) {
          refreshed.provider_token = cached.provider_token
        }
        if (!refreshed.provider_refresh_token && cached.provider_refresh_token) {
          refreshed.provider_refresh_token = cached.provider_refresh_token
        }
        persistSession(refreshed)
        setSession(refreshed)
      } catch {
        persistSession(null)
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const signInWithGitHub = useCallback(async () => {
    const supabaseUrl = getSupabaseUrl()
    const anonKey = getSupabaseAnonKey()

    if (!supabaseUrl || !anonKey) {
      throw new Error(
        'Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      )
    }

    const { verifier, challenge } = await createPkcePair()
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)

    const redirectTo = `${window.location.origin}/auth/callback`
    const url = new URL(`${supabaseUrl}/auth/v1/authorize`)
    url.searchParams.set('provider', 'github')
    url.searchParams.set('redirect_to', redirectTo)
    url.searchParams.set('scopes', 'repo write:repo_hook')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')

    window.location.assign(url.toString())
  }, [])

  const completeOAuth = useCallback(async () => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)

    if (!code || !verifier) {
      throw new Error('Unable to complete GitHub sign-in. Missing authorization code.')
    }

    const nextSession = await exchangeCodeForSession(code, verifier)
    persistSession(nextSession)
    sessionStorage.removeItem(PKCE_VERIFIER_KEY)
    setSession(nextSession)
  }, [])

  const signOut = useCallback(async () => {
    try {
      if (session?.access_token) {
        await revokeSession(session.access_token)
      }
    } finally {
      persistSession(null)
      setSession(null)
    }
  }, [session])

  const signInMock = useCallback(() => {
    const mockSession: AuthSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: 2524608000,
      user: {
        id: 'mock-user-id',
        email: 'operator@qaforge.ai',
        full_name: 'Demo Operator',
        user_name: 'demo-operator',
      },
    }
    persistSession(mockSession)
    setSession(mockSession)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: Boolean(session),
      signInWithGitHub,
      completeOAuth,
      signOut,
      signInMock,
    }),
    [completeOAuth, isLoading, session, signInWithGitHub, signOut, signInMock],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>.')
  }

  return context
}
