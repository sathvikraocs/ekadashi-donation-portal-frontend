import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js'

import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
)

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'


export default function Donations({ profile }) {
  const chartRef = useRef(null)

  const [summary, setSummary] = useState({
    totalAmount: 0,
    count: 0
  })

  const [donations, setDonations] = useState([])
  const [contacts, setContacts] = useState([])
  const [ekadashis, setEkadashis] = useState([])
  const [contactFilter, setContactFilter] = useState('')
  const [ekadashiFilter, setEkadashiFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [chartData, setChartData] = useState([])
  const [devotees, setDevotees] = useState([])
const [centres, setCentres] = useState([])
const [devoteeFilter, setDevoteeFilter] = useState('')
const [centreFilter, setCentreFilter] = useState('')
const [currentPage, setCurrentPage] = useState(1)
const [rowsPerPage, setRowsPerPage] = useState(10)




  /* -------------------- CHART -------------------- */

  const chartJsData = {
    labels: chartData.map(c => c.label),
    datasets: [
      {
        label: 'Total Donation (₹)',
        data: chartData.map(c => c.value),
        backgroundColor: '#4caf50'
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: value => `₹${value}`
        }
      }
    }
  }

  /* -------------------- INIT -------------------- */

useEffect(() => {
  loadContacts()
  loadEkadashis()
  if (profile?.role === 'admin') {
    loadDevotees()
    loadCentres()
  }
  loadDonations()
}, [profile])


useEffect(() => {
  setCurrentPage(1)
  loadDonations()
}, [
  contactFilter,
  ekadashiFilter,
  fromDate,
  toDate,
  devoteeFilter,
  centreFilter
])

useEffect(() => {
  setCurrentPage(1)
}, [rowsPerPage])



  /* -------------------- LOADERS -------------------- */

  async function loadContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('id, contact_name')
      .order('contact_name')

    setContacts(data || [])
  }

  async function loadDevotees() {
  const { data } = await supabase
    .from('core_devotee_profiles')
    .select('user_id, name')
    .order('name')

  setDevotees(data || [])
}

async function loadCentres() {
  const { data } = await supabase
    .from('centres')
    .select('id, centre_name')
    .order('centre_name')

  setCentres(data || [])
}


async function loadEkadashis() {
  const today = new Date().toISOString().split('T')[0]

  // ADMIN → ALL EKADASHIS
  if (profile?.role === 'admin') {
    const { data } = await supabase
      .from('ekadashi_calendar')
      .select('id, ekadashi_name, ekadashi_date')
      .order('ekadashi_date')

    setEkadashis(data || [])
    return
  }

  // EXISTING 3+1 LOGIC (UNCHANGED)
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
    .order('ekadashi_date')
    .limit(1)

  setEkadashis([...(past || []), ...(future || [])])
}

  async function loadDonations() {
    let query = supabase
      .from('donations')
.select(`
  id,
  amount,
  transaction_id,
  receipt_number,
  transferred,
  transaction_date,
  contacts:contact_id!inner (
    contact_name,
    core_devotee_profiles:core_devotee_id!inner (
      name,
      centres:centre_id (
        centre_name
      )
    )
  ),
  ekadashi_calendar:ekadashi_id (
    ekadashi_name,
    ekadashi_date
  )
`)

      .order('transaction_date', { ascending: false })

    if (contactFilter) query = query.eq('contact_id', contactFilter)
    if (ekadashiFilter) query = query.eq('ekadashi_id', ekadashiFilter)
    if (fromDate) query = query.gte('transaction_date', fromDate)
    if (toDate) query = query.lte('transaction_date', toDate)
    if (profile?.role === 'admin' && devoteeFilter)
  query = query.eq('contacts.core_devotee_id', devoteeFilter)

if (profile?.role === 'admin' && centreFilter)
  query = query.eq(
    'contacts.core_devotee_profiles.centre_id',
    centreFilter
  )


    const { data } = await query
    setDonations(data || [])

    const total = (data || []).reduce((s, d) => s + Number(d.amount), 0)
    setSummary({ totalAmount: total, count: data?.length || 0 })

    const ekadashiMap = {}
    ;(data || []).forEach(d => {
      const ek = d.ekadashi_calendar
      if (!ek) return

      const label = `${ek.ekadashi_name} (${ek.ekadashi_date})`
      ekadashiMap[label] =
        (ekadashiMap[label] || 0) + Number(d.amount)
    })

    setChartData(
      Object.entries(ekadashiMap).map(([label, value]) => ({
        label,
        value
      }))
    )
  }

const totalPages = Math.ceil(donations.length / rowsPerPage)

const paginatedDonations = donations.slice(
  (currentPage - 1) * rowsPerPage,
  currentPage * rowsPerPage
)

  /* -------------------- CLEAR FILTERS -------------------- */

function clearAllFilters() {
  setContactFilter('')
  setEkadashiFilter('')
  setFromDate('')
  setToDate('')
  setDevoteeFilter('')
  setCentreFilter('')
}

  /* -------------------- EXPORT -------------------- */

  function exportVisibleDonationsPDF() {
    if (donations.length === 0) {
      alert('No data to export')
      return
    }

    const doc = new jsPDF({ orientation: 'landscape' })

    const devotee = profile?.name || '—'
    const centre = profile?.centres?.centre_name || '—'
    const exportDate = new Date().toLocaleDateString('en-IN')

    /* Header */
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Donation History Report', 14, 15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    doc.text(`Core Devotee: ${devotee}`, 14, 22)
    doc.text(`Centre: ${centre}`, 14, 28)
    doc.text(`Export Date: ${exportDate}`, 14, 34)

    /* Summary */
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Summary', 14, 45)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    doc.text(`Total Donations: Rs. ${Number(summary.totalAmount)}`, 14, 52)
    doc.text(`Total Entries: ${Number(summary.count)}`, 14, 58)

    let currentY = 65

/* Chart */
if (chartRef.current) {
  const chartCanvas = chartRef.current.canvas
  const chartImage = chartCanvas.toDataURL('image/png', 1.0)

  // Chart title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Summary Chart', 14, currentY)

  currentY += 6

  // Maintain aspect ratio
  const imgProps = doc.getImageProperties(chartImage)
  const pdfWidth = doc.internal.pageSize.getWidth() - 28
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

  doc.addImage(
    chartImage,
    'PNG',
    14,
    currentY,
    pdfWidth,
    pdfHeight,
    undefined,
    'FAST'
  )

  currentY += pdfHeight + 12
}


    /* Table */
    autoTable(doc, {
  startY: currentY,
    head: [[
        '#',
        'Contact Name',
        ...(profile?.role === 'admin' ? ['Core Devotee', 'Centre'] : []),
        'Ekadashi',
        'Ekadashi Date',
        'Transaction Date',
        'Amount',
        'Transaction ID',
        'Receipt Number',
        'Transferred'
        ]],
body: donations.map((d, index) => [
  index + 1,
  d.contacts?.contact_name || '',
  ...(profile?.role === 'admin'
    ? [
        d.contacts?.core_devotee_profiles?.name || '',
        d.contacts?.core_devotee_profiles?.centres?.centre_name || ''
      ]
    : []),
  d.ekadashi_calendar?.ekadashi_name || '',
  d.ekadashi_calendar?.ekadashi_date || '',
  d.transaction_date || '',
  d.amount,
  d.transaction_id || '',
  d.receipt_number || '',
  d.transferred ? 'Yes' : 'No'
]),

      styles: { fontSize: 8 },
      didDrawPage: data => {
        const pageCount = doc.internal.getNumberOfPages()
        doc.setFontSize(9)
        doc.text(
          `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        )
      }
    })

    doc.save('donation-history.pdf')
  }

  function exportVisibleDonationsExcel() {
  if (donations.length === 0) {
    alert('No data to export')
    return
  }

  const rows = donations.map((d, index) => {
    const baseRow = {
      '#': index + 1,
      'Contact Name': d.contacts?.contact_name || '',
      Ekadashi: d.ekadashi_calendar?.ekadashi_name || '',
      'Ekadashi Date': d.ekadashi_calendar?.ekadashi_date || '',
      'Transaction Date': d.transaction_date || '',
      Amount: Number(d.amount),
      'Transaction ID': d.transaction_id || '',
      'Receipt Number': d.receipt_number || '',
      Transferred: d.transferred ? 'Yes' : 'No'
    }

    if (profile?.role === 'admin') {
      baseRow['Core Devotee'] =
        d.contacts?.core_devotee_profiles?.name || ''
      baseRow['Centre'] =
        d.contacts?.core_devotee_profiles?.centres?.centre_name || ''
    }

    return baseRow
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Donations')

  XLSX.writeFile(workbook, 'donation-history.xlsx')
}

  /* -------------------- UI -------------------- */

  return (
  <div className="page">

    {/* ================= HEADER ================= */}
    <div className="card">
      <h2>Donation History</h2>
    </div>

    {/* ================= FILTERS ================= */}
    <div className="card">
      <h3>Filters</h3>

      <div className="filter-bar">
        <select
          value={contactFilter}
          onChange={e => {
            setContactFilter(e.target.value)
            setCurrentPage(1)
          }}
        >
          <option value="">All Contacts</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id}>
              {c.contact_name}
            </option>
          ))}
        </select>

        <select
          value={ekadashiFilter}
          onChange={e => {
            setEkadashiFilter(e.target.value)
            setCurrentPage(1)
          }}
        >
          <option value="">All Ekadashis</option>
          {ekadashis.map(e => (
            <option key={e.id} value={e.id}>
              {e.ekadashi_name} ({e.ekadashi_date})
            </option>
          ))}
        </select>
      </div>

      {profile?.role === 'admin' && (
        <div className="filter-bar" style={{ marginTop: 12 }}>
          <select
            value={devoteeFilter}
            onChange={e => {
              setDevoteeFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Core Devotees</option>
            {devotees.map(d => (
              <option key={d.user_id} value={d.user_id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={centreFilter}
            onChange={e => {
              setCentreFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Centres</option>
            {centres.map(c => (
              <option key={c.id} value={c.id}>
                {c.centre_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-bar" style={{ marginTop: 12 }}>
        <label>
          From
          <input
            type="date"
            value={fromDate}
            onChange={e => {
              setFromDate(e.target.value)
              setCurrentPage(1)
            }}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={toDate}
            onChange={e => {
              setToDate(e.target.value)
              setCurrentPage(1)
            }}
          />
        </label>

        <button
          className="btn btn-secondary"
          onClick={clearAllFilters}
        >
          Clear Filters
        </button>
      </div>
    </div>

    {/* ================= SUMMARY ================= */}
    <div className="card">
  <h3 style={{ fontSize: 18, marginBottom: 12 }}>Summary</h3>

  <div
    style={{
      display: 'flex',
      gap: 40,
      flexWrap: 'wrap'
    }}
  >
    <div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>Total Donations</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>
        ₹{summary.totalAmount}
      </div>
    </div>

    <div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>Total Entries</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>
        {summary.count}
      </div>
    </div>
  </div>
</div>


    {/* ================= EXPORT ================= */}
    <div className="card">
      <h3>Export</h3>

      <div className="filter-bar">
        <button
          className="btn btn-primary"
          onClick={exportVisibleDonationsPDF}
        >
          Export Visible Data (PDF)
        </button>

        <button
          className="btn btn-success"
          onClick={exportVisibleDonationsExcel}
        >
          Export Visible Data (Excel)
        </button>
      </div>
    </div>

    {/* ================= CHART ================= */}
    <div className="card">
      <h3>Donation Summary Chart</h3>

      {chartData.length === 0 ? (
        <p>No data for selected filters.</p>
      ) : (
        <div style={{ maxWidth: 900 }}>
          <Bar ref={chartRef} data={chartJsData} options={chartOptions} />
        </div>
      )}
    </div>

    {/* ================= TABLE ================= */}
    <div className="card">
      <h3>Donation Entries</h3>

      <div className="pagination" style={{ marginBottom: 12 }}>
        <label>
          Rows per page
          <select
            value={rowsPerPage}
            onChange={e => {
              setRowsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>


<table className="table donations-table">
  <colgroup>
    <col style={{ width: '40px' }} />
    <col style={{ width: '180px' }} />
    {profile?.role === 'admin' ? <col style={{ width: '160px' }} /> : null}
    {profile?.role === 'admin' ? <col style={{ width: '140px' }} /> : null}
    <col style={{ width: '260px' }} />
    <col style={{ width: '140px' }} />
    <col style={{ width: '120px' }} />
    <col style={{ width: '160px' }} />
    <col style={{ width: '140px' }} />
    <col style={{ width: '110px' }} />
  </colgroup>


        <thead>
          <tr>
            <th>#</th>
            <th>Contact</th>
            {profile?.role === 'admin' && <th>Core Devotee</th>}
            {profile?.role === 'admin' && <th>Centre</th>}
            <th>Ekadashi</th>
            <th>Transaction Date</th>
            <th>Amount</th>
            <th>Transaction ID</th>
            <th>Receipt No.</th>
            <th>Transferred</th>
          </tr>
        </thead>
<tbody>
  {paginatedDonations.map((d, index) => (
    <tr key={d.id}>
      <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>

      <td>{d.contacts?.contact_name}</td>

      {profile?.role === 'admin' && (
        <td>{d.contacts?.core_devotee_profiles?.name}</td>
      )}

      {profile?.role === 'admin' && (
        <td>{d.contacts?.core_devotee_profiles?.centres?.centre_name}</td>
      )}

      {/* Ekadashi */}
      <td>
        <div style={{ fontWeight: 500 }}>
          {d.ekadashi_calendar?.ekadashi_name}
        </div>
        {d.ekadashi_calendar?.ekadashi_date && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {d.ekadashi_calendar.ekadashi_date}
          </div>
        )}
      </td>

      {/* Transaction Date */}
      <td style={{ whiteSpace: 'nowrap' }}>
        {d.transaction_date}
      </td>

      {/* Amount — isolated */}
      <td
        style={{
          textAlign: 'left',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}
      >
        ₹{d.amount}
      </td>

      {/* Transaction ID */}
      <td
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        title={d.transaction_id}
      >
        {d.transaction_id}
      </td>

      {/* Receipt */}
      <td
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        title={d.receipt_number}
      >
        {d.receipt_number}
      </td>

      {/* Transferred */}
      <td style={{ textAlign: 'center', fontWeight: 600 }}>
        {d.transferred ? 'Yes' : 'No'}
      </td>
    </tr>
  ))}
</tbody>


      </table>

      <div className="pagination">
        <button
          className="btn btn-secondary"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(p => p - 1)}
        >
          Prev
        </button>

        <span>
          Page {currentPage} of {totalPages || 1}
        </span>

        <button
          className="btn btn-secondary"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          Next
        </button>
      </div>
    </div>

  </div>
)
}