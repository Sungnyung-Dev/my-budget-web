import { useRef, useState, type FormEvent } from 'react'
import './LoginPage.css'
export function LoginPage({ busy, message, onLogin }: {
  busy: boolean; message: string | null; onLogin: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const password = useRef<HTMLInputElement>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !password.current) return
    const value = password.current.value
    password.current.value = ''
    void onLogin(username.trim(), value)
  }
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <p className="login-eyebrow">MY PERSONAL LEDGER</p>
        <h1>나의 가계부</h1><p>로그인하고 나의 기록을 이어가세요.</p>
        <label htmlFor="username">사용자명</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
          maxLength={100} required value={username} disabled={busy} onChange={event => setUsername(event.target.value)} />
        <label htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required ref={password} disabled={busy} />
        {message && <p role="alert">{message}</p>}
        <button className="primary-button" disabled={busy} type="submit">{busy ? '로그인 중…' : '로그인'}</button>
        <p className="login-note">이 기기에서 30일 동안 로그인을 유지합니다.<br />공용 기기에서는 사용 후 로그아웃해 주세요.</p>
      </form>
    </main>
  )
}
