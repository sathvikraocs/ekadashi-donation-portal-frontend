import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Home({ profile }) {
  const router = useRouter()
  const [session, setSession] = useState(null)

  const [stats, setStats] = useState({
    totalDonations: 0,
    count: 0
  })

  const [ekadashis, setEkadashis] = useState([])
  const [selectedEkadashi, setSelectedEkadashi] = useState('')
  const [selectedEkadashiTotal, setSelectedEkadashiTotal] = useState(0)
  const [selectedEkadashiInfo, setSelectedEkadashiInfo] = useState(null)

  /* -------------------- AUTH INIT -------------------- */

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/login')
        return
      }

      setSession(data.session)
      loadStats()
      loadEkadashis()
    }

    init()
  }, [])

  if (!session) return null

  /* -------------------- LOADERS -------------------- */

  async function loadStats() {
    const { data, error } = await supabase
      .from('donations')
      .select('amount')

    if (error) {
      console.error(error)
      return
    }

    const total = data.reduce(
      (sum, d) => sum + Number(d.amount),
      0
    )

    setStats({
      totalDonations: total,
      count: data.length
    })
  }

async function loadEkadashis() {
  const today = new Date().toISOString().split('T')[0]

  // ---------------- ADMIN: NO RESTRICTION ----------------
  if (profile?.role === 'admin') {
    const { data, error } = await supabase
      .from('ekadashi_calendar')
      .select('id, ekadashi_name, ekadashi_date')
      .order('ekadashi_date', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setEkadashis(data || [])

    // Default: most recent past or today
    const pastOrToday = (data || [])
      .filter(e => e.ekadashi_date <= today)
      .sort((a, b) => new Date(b.ekadashi_date) - new Date(a.ekadashi_date))[0]

    if (pastOrToday) {
      setSelectedEkadashi(pastOrToday.id)
      loadEkadashiBasedTotal(pastOrToday.id)
    } else if (data?.length > 0) {
      setSelectedEkadashi(data[0].id)
      loadEkadashiBasedTotal(data[0].id)
    }

    return
  }

  // ---------------- CORE DEVOTEE: PAST + FUTURE RULE ----------------

  const { data: past, error: pastError } = await supabase
    .from('ekadashi_calendar')
    .select('id, ekadashi_name, ekadashi_date')
    .lt('ekadashi_date', today)
    .order('ekadashi_date', { ascending: false })
    .limit(3)

  if (pastError) {
    console.error(pastError)
    return
  }

  const { data: future, error: futureError } = await supabase
    .from('ekadashi_calendar')
    .select('id, ekadashi_name, ekadashi_date')
    .gte('ekadashi_date', today)
    .order('ekadashi_date', { ascending: true })
    .limit(1)

  if (futureError) {
    console.error(futureError)
    return
  }

  const combined = [...past, ...future].sort(
    (a, b) => new Date(a.ekadashi_date) - new Date(b.ekadashi_date)
  )

  setEkadashis(combined)

  const pastOrToday = combined
    .filter(e => e.ekadashi_date <= today)
    .sort((a, b) => new Date(b.ekadashi_date) - new Date(a.ekadashi_date))[0]

  if (pastOrToday) {
    setSelectedEkadashi(pastOrToday.id)
    loadEkadashiBasedTotal(pastOrToday.id)
  } else if (combined.length > 0) {
    setSelectedEkadashi(combined[0].id)
    loadEkadashiBasedTotal(combined[0].id)
  }
}


 async function loadEkadashiBasedTotal(ekadashiId) {
  if (!ekadashiId) return

  // 1️⃣ Fetch Ekadashi info directly (always exists)
  const { data: ekadashiInfo, error: ekError } = await supabase
    .from('ekadashi_calendar')
    .select('ekadashi_name, ekadashi_date')
    .eq('id', ekadashiId)
    .single()

  if (ekError) {
    console.error(ekError)
    return
  }

  setSelectedEkadashiInfo(ekadashiInfo)

  // 2️⃣ Fetch donations (may be zero rows)
  const { data: donations, error } = await supabase
    .from('donations')
    .select('amount')
    .eq('ekadashi_id', ekadashiId)
  if (error) {
    console.error(error)
    return
  }

  const total = (donations || []).reduce(
    (sum, d) => sum + Number(d.amount),
    0
  )

  setSelectedEkadashiTotal(total)
}


  /* -------------------- HANDLERS -------------------- */

  function handleEkadashiChange(e) {
    const value = e.target.value
    setSelectedEkadashi(value)

    if (value) {
      loadEkadashiBasedTotal(value)
    }
  }

  /* -------------------- UI -------------------- */

 return (
  <div className="page">
    <div className="card">
      <h2>Dashboard</h2>

      {profile?.role === 'admin' && (
        <div className="card admin-info">

          <strong>Admin Access Enabled</strong>
          <p style={{ marginTop: 6 }}>
            You are logged in as an administrator.
            You have visibility across all core devotees, contacts, and donations.
          </p>
        </div>
      )}
    </div>

    <div className="card">
      <h3>Summary</h3>
      <p>Total Donations: ₹{stats.totalDonations}</p>
      <p>Total Entries: {stats.count}</p>
    </div>

<div className="card">
  <h3>Ekadashi-wise Total</h3>

  <div className="filter-bar" style={{ marginBottom: 16 }}>
    <select value={selectedEkadashi} onChange={handleEkadashiChange}>
      {ekadashis.map(e => (
        <option key={e.id} value={e.id}>
          {e.ekadashi_name} ({e.ekadashi_date})
        </option>
      ))}
    </select>
  </div>

  {selectedEkadashiInfo && (
    <div
      style={{
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: 420
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e3a8a' }}>
        {selectedEkadashiInfo.ekadashi_name}
      </div>

      <div style={{ fontSize: 13, color: '#475569' }}>
        Date: {selectedEkadashiInfo.ekadashi_date}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 700,
          color: '#111827'
        }}
      >
        ₹{selectedEkadashiTotal}
      </div>

      <div style={{ fontSize: 12, color: '#64748b' }}>
        Total donations for this Ekadashi
      </div>
    </div>
  )}
</div>


    <div className="card">
      <h3>Quick Actions</h3>

      <div className="filter-bar">
        <button
          className="btn btn-primary"
          onClick={() => router.push('/contacts')}
        >
          Manage Contacts
        </button>

        <button
          className="btn btn-success"
          onClick={() => router.push('/add-donation')}
        >
          Add Donation
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => router.push('/donations')}
        >
          Donation History
        </button>
      </div>
    </div>
  </div>
)
}