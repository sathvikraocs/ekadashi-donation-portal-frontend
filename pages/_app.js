import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import '../styles/globals.css'
import '../styles/dashboard.css'



export default function MyApp({ Component, pageProps }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      const isLoginPage = router.pathname === '/login'

      if (!session && !isLoginPage) {
        router.replace('/login')
        return
      }

      if (session) {
        const { data, error } = await supabase
          .from('core_devotee_profiles')
          .select(`
            name,
            role,
            centres:centre_id (
              centre_name
            )
          `)
          .eq('user_id', session.user.id)
          .single()

        if (error) {
          console.error('Profile load failed:', error)
        } else {
          setProfile(data)
        }
      }

      setChecking(false)
    }

    init()
  }, [router.pathname])

  if (checking) return null

  const isLoginPage = router.pathname === '/login'

  return (
    <>
      {!isLoginPage && <Header profile={profile} />}
      <Component {...pageProps} profile={profile} />
    </>
  )
}
