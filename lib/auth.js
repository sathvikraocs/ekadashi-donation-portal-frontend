import { supabase } from './supabase'

export async function getUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('core_devotee_profiles')
    .select(`
      id,
      name,
      role,
      centres:centre_id ( centre_name )
    `)
    .eq('user_id', session.user.id)
    .single()

  if (error) {
    console.error(error)
    return null
  }

  return data
}