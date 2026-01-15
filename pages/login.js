import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      window.location.href = '/'
    }
  }

return (
  <div className="page">
    <div
      className="card"
      style={{
        maxWidth: 420,
        margin: '60px auto',
        padding: '28px 32px'
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Welcome to the Ekadashi Donation Portal</h2>

      <p
        style={{
          marginBottom: 22,
          color: '#4b5563',
          fontSize: 14
        }}
      >
        Please log in using your registered email and password to continue.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label>
          Email
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <button
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    </div>
  </div>
)

}
