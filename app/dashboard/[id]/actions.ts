'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'

export async function submitExpense(formData: FormData) {
  const supabase = await createClient()
  
  const orgId = formData.get('org_id') as string
  const amount = parseFloat(formData.get('amount') as string)
  const description = formData.get('description') as string
  const category = formData.get('category') as string 

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('expenses')
    .insert({
      org_id: orgId,
      submitted_by: user.id,
      amount: amount,
      description: description,
      category: category,
      status: 'pending'
    })

  if (error) {
    console.error('Error submitting expense:', error)
    throw new Error(`Error submitting expense: ${error.message}`)
  }

  revalidatePath(`/dashboard/${orgId}`)
}

export async function approveExpense(formData: FormData) {
  const supabase = await createClient()
  const expenseId = formData.get('expense_id') as string
  const orgId = formData.get('org_id') as string

  // Call the secure Postgres RPC
  const { error } = await supabase.rpc('approve_expense', {
    e_id: expenseId
  })

  if (error) {
    console.error('Approval failed:', error.message)
    // In a real app we'd return this to show a toast, but we'll keep it simple
  }
    if (error) {
    throw new Error(`DATABASE ERROR: ${error.message} (Details: ${error.details || 'None'})`)
  }

  // Refresh the page to show the new wallet balance and updated expense status
  revalidatePath(`/dashboard/${orgId}`)
}