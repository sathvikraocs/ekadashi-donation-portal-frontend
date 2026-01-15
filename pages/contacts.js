import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'


export default function Contacts({ profile }) {
  const router = useRouter()

  const [contacts, setContacts] = useState([])
  const [coreDevotees, setCoreDevotees] = useState([])
  const [coreDevoteeFilter, setCoreDevoteeFilter] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  /* ---------- ADDITIVE: PAGINATION STATE ---------- */
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [enrolmentDate, setEnrolmentDate] = useState('')


  /* -------------------- INIT -------------------- */

  useEffect(() => {
    if (!profile) return
    checkSession()
    fetchContacts()

    if (profile.role === 'admin') {
      fetchCoreDevotees()
    }
  }, [profile])

  async function checkSession() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) router.push('/login')
  }

  /* -------------------- FETCH DATA -------------------- */

  async function fetchContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        contact_name,
        contact_number,
        address,
        enrolment_date,
        core_devotee_id,
        core_devotee_profiles:core_devotee_id (
          name
        )
      `)
      .order('contact_name')

    if (error) {
      console.error(error)
      return
    }

    setContacts(data || [])
  }

  async function fetchCoreDevotees() {
    const { data, error } = await supabase
      .from('core_devotee_profiles')
      .select('user_id, name')
      .order('name')

    if (!error) setCoreDevotees(data || [])
  }

  /* -------------------- ADD CONTACT (CORE ONLY) -------------------- */

  async function addContact() {
    if (!name || !phone) {
      alert('Name and phone are required')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()

    const { error } = await supabase.from('contacts').insert({
      core_devotee_id: session.user.id,
      contact_name: name,
      contact_number: phone,
      address,
      enrolment_date: enrolmentDate || new Date().toISOString().split('T')[0]
    })

    if (error) {
      alert('Insert failed: ' + error.message)
      return
    }

    setName('')
    setPhone('')
    setAddress('')
    setEnrolmentDate('')
    fetchContacts()
  }

  /* -------------------- FILTERED VIEW -------------------- */

  const visibleContacts =
    profile.role === 'admin' && coreDevoteeFilter
      ? contacts.filter(c => c.core_devotee_id === coreDevoteeFilter)
      : contacts

  /* ---------- ADDITIVE: PAGINATION DERIVED DATA ---------- */

  const totalPages = Math.ceil(visibleContacts.length / rowsPerPage)

  const paginatedContacts = visibleContacts.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  /* -------------------- PDF EXPORT -------------------- */

  function exportContactsPDF() {
    if (visibleContacts.length === 0) {
      alert('No contacts to export')
      return
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const exportDate = new Date().toLocaleDateString('en-IN')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Contacts Report', 14, 15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Exported By: ${profile.name}`, 14, 22)
    doc.text(`Export Date: ${exportDate}`, 14, 28)

    const head = ['#', 'Name', 'Phone', 'Address', 'Enrolment Date']
    if (profile.role === 'admin') head.push('Core Devotee')

    autoTable(doc, {
      startY: 42,
      tableWidth: 'wrap',
      head: [head],
      body: visibleContacts.map((c, index) => {
        const row = [
          index + 1,
          c.contact_name,
          c.contact_number,
          c.address || '',
          c.enrolment_date || ''
        ]

        if (profile.role === 'admin') {
          row.push(c.core_devotee_profiles?.name || '')
        }

        return row
      }),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [33, 150, 243],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 90 },
        4: { cellWidth: 30 },
        ...(profile.role === 'admin' && {
          5: { cellWidth: 40 }
        })
      },
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

    doc.save('contacts.pdf')
  }

  function exportContactsExcel() {
  if (visibleContacts.length === 0) {
    alert('No contacts to export')
    return
  }

  const rows = visibleContacts.map((c, index) => {
    const baseRow = {
      '#': index + 1,
      Name: c.contact_name,
      Phone: c.contact_number,
      Address: c.address || '',
      'Enrolment Date': c.enrolment_date || ''
    }

    if (profile.role === 'admin') {
      baseRow['Core Devotee'] = c.core_devotee_profiles?.name || ''
    }

    return baseRow
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')

  XLSX.writeFile(workbook, 'contacts.xlsx')
}


  /* -------------------- UI -------------------- */

  if (!profile) return null

return (
  <div className="page">

    {/* ---------- HEADER + EXPORTS ---------- */}
    <div className="card">
      <h2>Contacts</h2>

      <div className="filter-bar">
        <button className="btn btn-primary" onClick={exportContactsPDF}>
          Export Contacts (PDF)
        </button>

        <button className="btn btn-success" onClick={exportContactsExcel}>
          Export Contacts (Excel)
        </button>
      </div>
    </div>

    {/* ---------- ADMIN FILTER ---------- */}
    {profile.role === 'admin' && (
      <div className="card">
        <div className="filter-bar">
          <label>
            Filter by Core Devotee:{' '}
            <select
              value={coreDevoteeFilter}
              onChange={e => {
                setCoreDevoteeFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="">All Core Devotees</option>
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

    {/* ---------- ADD CONTACT (NON-ADMIN) ---------- */}
    {profile.role !== 'admin' && (
      <div className="card">
        <h4>Add New Contact</h4>

        <input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <br /><br />

        <input
          placeholder="Phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <br /><br />

        <input
          placeholder="Address"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
        <br /><br />

        <input
  type="date"
  value={enrolmentDate}
  onChange={e => setEnrolmentDate(e.target.value)}
/>
<br /><br />


        <button className="btn btn-success" onClick={addContact}>
          Add Contact
        </button>
      </div>
    )}

    {/* ---------- CONTACTS TABLE ---------- */}
    <div className="card">
      <h4>
        {profile.role === 'admin' ? 'All Contacts' : 'Your Contacts'}
      </h4>

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Enrolment Date</th>
            {profile.role === 'admin' && <th>Core Devotee</th>}
          </tr>
        </thead>
        <tbody>
          {paginatedContacts.map((c, index) => (
            <tr key={c.id}>
              <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>
              <td>{c.contact_name}</td>
              <td>{c.contact_number}</td>
              <td>{c.address}</td>
              <td>{c.enrolment_date}</td>
              {profile.role === 'admin' && (
                <td>{c.core_devotee_profiles?.name}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- PAGINATION ---------- */}
      <div className="pagination">
        <label>
          Rows per page:{' '}
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