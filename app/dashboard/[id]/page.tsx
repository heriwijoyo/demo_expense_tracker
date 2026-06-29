import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { submitExpense, approveExpense } from './actions'
import Link from 'next/link'
import WebhookTester from './WebhookTester'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch Org Details AND Wallet Balance
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('name, org_wallets(balance)')
    .eq('id', id)
    .single()

  if (orgError || !org) redirect('/dashboard')

  // Fetch Expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  // Handle the 1-to-1 relationship object returned by Supabase
  const walletData = org.org_wallets as any
  const walletBalance = Array.isArray(walletData) 
    ? (walletData[0]?.balance || 0) 
    : (walletData?.balance || 0)

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/dashboard" className="text-blue-500 hover:underline text-sm">
          &larr; Back to Dashboard
        </Link>
        
        {/* START OF MODIFICATION: Added a flex container to hold both the Wallet and the new Audit Log link side-by-side */}
        <div className="flex gap-4 items-center">
          <Link 
            href={`/dashboard/${id}/audit`} 
            className="text-sm font-medium border px-3 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            View Audit Log
          </Link>
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-mono font-bold">
            Wallet: ${walletBalance.toFixed(2)}
          </div>
        </div>
        {/* END OF MODIFICATION */}
      </div>

      <h1 className="text-3xl font-bold mb-8">{org.name} - Expenses</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Submit Expense Form */}
        <div className="col-span-1 p-6 border rounded-lg bg-gray-50 dark:bg-zinc-900 h-fit">
          <h2 className="text-xl font-semibold mb-4">Submit Expense</h2>
          <form action={submitExpense} className="flex flex-col gap-4">
            <input type="hidden" name="org_id" value={id} />
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($)</label>
              <input type="number" step="0.01" name="amount" required className="w-full px-3 py-2 border rounded-md bg-transparent" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input type="text" name="description" required className="w-full px-3 py-2 border rounded-md bg-transparent" placeholder="e.g. Client Lunch" />
            </div>
            
            {/* MODIFICATION: Category select dropdown added during the schema fix */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select name="category" required className="w-full px-3 py-2 border rounded-md bg-transparent dark:bg-zinc-900">
                <option value="Meals">Meals & Entertainment</option>
                <option value="Travel">Travel</option>
                <option value="Software">Software & Subscriptions</option>
                <option value="Office">Office Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {/* END OF MODIFICATION */}

            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md mt-2">
              Submit
            </button>
          </form>
        </div>

        {/* Expense List */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-4">Recent Expenses</h2>
          {expenses && expenses.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 dark:bg-zinc-800">
                  <tr>
                    <th className="p-3 border-b">Description</th>
                    
                    {/* MODIFICATION: Added Category column header */}
                    <th className="p-3 border-b">Category</th>
                    {/* END OF MODIFICATION */}
                    
                    <th className="p-3 border-b">Amount</th>
                    <th className="p-3 border-b">Status</th>
                    <th className="p-3 border-b">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900">
                      <td className="p-3">{expense.description}</td>
                      
                      {/* MODIFICATION: Rendered the category data into the table */}
                      <td className="p-3">{expense.category}</td>
                      {/* END OF MODIFICATION */}

                      <td className="p-3 font-mono">${expense.amount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full uppercase ${expense.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {expense.status === 'pending' && (
                          <form action={approveExpense}>
                            <input type="hidden" name="expense_id" value={expense.id} />
                            <input type="hidden" name="org_id" value={id} />
                            <button type="submit" className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors">
                              Approve
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 border rounded-md p-8 text-center border-dashed">No expenses submitted yet.</p>
          )}
        </div>

        <WebhookTester orgId={id} />
      </div>
    </div>
  )
}