/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { setCredentials } from '@/shared/auth'
import { api, ApiError } from '@/shared/api'
import css from './LoginPage.module.css'

interface Props {
  onLogin: () => void
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!username || !password) return

    setLoading(true)
    setError('')

    setCredentials(username, password)

    try {
      await api.get('/cameras?limit=1&offset=0')
      onLogin()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ERR_CLIENT_AUTH') {
        setError('Неверный логин или пароль')
      } else {
        onLogin()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={css.root}>
      <div className={css.card}>
        <h1 className={css.title}>ANPR</h1>
        <p className={css.subtitle}>Введите данные для входа</p>
        <form className={css.form} onSubmit={handleSubmit}>
          <div className={css.field}>
            <label className={css.label}>Логин</label>
            <input
              className={css.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className={css.field}>
            <label className={css.label}>Пароль</label>
            <input
              className={css.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className={css.error}>{error}</div>}
          <button className={css.submit} type="submit" disabled={loading || !username || !password}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
