'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../utils/supabase/server'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Call our secure Postgres function
  const { error } = await supabase.rpc('create_new_org', {
    org_name: name
  })

  if (error) {
    console.error('Error creating org:', error)
    throw new Error(`Failed to create organization: ${error.message}`)
  }

  revalidatePath('/dashboard')
}