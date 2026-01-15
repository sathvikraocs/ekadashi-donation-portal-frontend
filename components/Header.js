import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Header({ profile }) {
  const router = useRouter()

return (
  <header className="app-header">
    <div className="header-left">
      <button
        className="btn btn-secondary"
        onClick={() => router.push('/')}
      >
        Dashboard
      </button>

      {profile && (
        <span className="header-welcome">
          Welcome, <strong>{profile.name}</strong>
          {profile.centres?.centre_name && (
            <> ({profile.centres.centre_name})</>
          )}
        </span>
      )}

      {profile?.role === 'admin' && (
        <span className="admin-badge">
          Administrator View
        </span>
      )}
    </div>

    <button
      className="btn btn-danger"
      onClick={async () => {
        await supabase.auth.signOut()
        router.push('/login')
      }}
    >
      Logout
    </button>
  </header>
)

}