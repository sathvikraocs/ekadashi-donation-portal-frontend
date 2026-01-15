import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function AddDonation({ profile }) {
  const router = useRouter()

  const [coreDevotees, setCoreDevotees] = useState([])
  const [selectedDevotee, setSelectedDevotee] = useState('')

  const [contacts, setContacts] = useState([])
  const [ekadashis, setEkadashis] = useState([])

  const [contactId, setContactId] = useState('')
  const [ekadashiId, setEkadashiId] = useState('')
  const [amount, setAmount] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [transferred, setTransferred] = useState(false)

  /* -------------------- INIT -------------------- */

  useEffect(() => {
    checkSession()
    loadEkadashis()

    if (profile?.role === 'admin') {
      loadCoreDevotees()
    } else {
      loadContacts()
    }
  }, [profile])

  async function checkSession() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) router.push('/login')
  }

  /* -------------------- LOADERS -------------------- */

  async function loadCoreDevotees() {
    const { data, error } = await supabase
      .from('core_devotee_profiles')
      .select('user_id, name')
      .order('name')

    if (error) {
      console.error(error)
      return
    }

    setCoreDevotees(data || [])
  }

  async function loadContacts(devoteeId) {
    let query = supabase
      .from('contacts')
      .select('id, contact_name, contact_number')
      .order('contact_name')

    if (profile?.role === 'admin' && devoteeId) {
      query = query.eq('core_devotee_id', devoteeId)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      return
    }

    setContacts(data || [])
    setContactId('')
  }

async function loadEkadashis() {
  const today = new Date().toISOString().split('T')[0]

  /* ---------------- ADMIN: ALL EKADASHIS ---------------- */
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
    setEkadashiId('') // ✅ NO DEFAULT SELECTION
    return
  }

  /* ---------------- CORE DEVOTEE: 3 + 1 RULE ---------------- */

  const { data: past } = await supabase
    .from('ekadashi_calendar')
    .select('id, ekadashi_name, ekadashi_date')
    .lt('ekadashi_date', today)
    .order('ekadashi_date', { ascending: false })
    .limit(3)

  const { data: future } = await supabase
    .from('ekadashi_calendar')
    .select('id, ekadashi_name, ekadashi_date')
    .gte('ekadashi_date', today)
    .order('ekadashi_date', { ascending: true })
    .limit(1)

  const combined = [...(past || []), ...(future || [])].sort(
    (a, b) => new Date(a.ekadashi_date) - new Date(b.ekadashi_date)
  )

  setEkadashis(combined)
  setEkadashiId('') // ✅ NO DEFAULT SELECTION
}


  /* -------------------- SAVE -------------------- */

  async function saveDonation() {
    if (!contactId || !ekadashiId || !amount) {
      alert('Contact, Ekadashi, and Amount are required')
      return
    }
    if (!transferred) {
    alert('Please confirm that the donation has been transferred before saving.')
    return
  }

    const { error } = await supabase.from('donations').insert({
      contact_id: contactId,
      ekadashi_id: ekadashiId,
      amount,
      transaction_id: transactionId,
      transaction_date: transactionDate || null,
      receipt_number: receiptNumber,
      transferred
    })

    if (error) {
      alert('Insert failed: ' + error.message)
      return
    }

    alert('Donation saved successfully')
    router.push('/')
  }

  /* -------------------- UI -------------------- */

return (
  <div className="page">
    <div className="card">
      <h2>Add Donation</h2>
    </div>

    {/* ---------- ADMIN: CORE DEVOTEE FILTER ---------- */}
    {profile?.role === 'admin' && (
      <div className="card">
        <div className="filter-bar">
          <label>
            Core Devotee
            <br />
            <select
              value={selectedDevotee}
              onChange={e => {
                const value = e.target.value
                setSelectedDevotee(value)
                loadContacts(value)
              }}
            >
              <option value="">-- Select Core Devotee --</option>
              {coreDevotees.map(d => (
                <option key={d.user_id} value={d.user_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    )}

    {/* ---------- DONATION FORM ---------- */}
    <div className="card">
      <div className="filter-bar">
        <label>
          Contact
          <br />
          <select
            value={contactId}
            onChange={e => setContactId(e.target.value)}
          >
            <option value="">-- Select Contact --</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.contact_name} ({c.contact_number})
              </option>
            ))}
          </select>
        </label>

        <label>
          Ekadashi
          <br />
          <select
            value={ekadashiId}
            onChange={e => setEkadashiId(e.target.value)}
          >
            <option value="">-- Select Ekadashi --</option>
            {ekadashis.map(e => (
              <option key={e.id} value={e.id}>
                {e.ekadashi_name} ({e.ekadashi_date})
              </option>
            ))}
          </select>
        </label>
      </div>

      <br />

      <div className="filter-bar">
        <label>
          Amount
          <br />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        <label>
          Transaction ID
          <br />
          <input
            value={transactionId}
            onChange={e => setTransactionId(e.target.value)}
          />
        </label>
      </div>

      <br />

      <div className="filter-bar">
        <label>
          Transaction Date
          <br />
          <input
            type="date"
            value={transactionDate}
            onChange={e => setTransactionDate(e.target.value)}
          />
        </label>

        <label>
          Receipt Number
          <br />
          <input
            value={receiptNumber}
            onChange={e => setReceiptNumber(e.target.value)}
          />
        </label>
      </div>

      <br />

<div className="checkbox-row">
  <input
    type="checkbox"
    id="transferred"
    checked={transferred}
    onChange={e => setTransferred(e.target.checked)}
  />
  <label htmlFor="transferred">Transferred</label>
</div>


      <br /><br />

      <button className="btn btn-success" onClick={saveDonation}>
        Save Donation
      </button>
    </div>
  </div>
)
}