import { redirect } from 'next/navigation'
import { createClient } from '../utils/supabase/server'
import { createOrganization } from './actions'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Protect the route - ensure user is logged in
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch organizations where the user is a member
  // We use an inner join to only get orgs where they exist in org_members
// Fetch organizations where the user is a member
  const { data: orgs, error: queryError } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      org_members!inner(role)
    `)
    .eq('org_members.user_id', user.id)

  // Add this block so we never fail silently again!
  if (queryError) {
    console.error("Database Query Error:", queryError)
  }  

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">My Organizations</h1>
        <div className="text-sm text-gray-500">Logged in as {user.email}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* List Existing Organizations */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Workspaces</h2>
          {orgs && orgs.length > 0 ? (
            <ul className="space-y-3">
              {orgs.map((org) => (
                <li key={org.id} className="border rounded-md shadow-sm hover:border-blue-500 transition-colors">
                  <Link href={`/dashboard/${org.id}`} className="p-4 flex justify-between items-center w-full">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded uppercase">
                      {org.org_members[0].role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">You don't belong to any organizations yet.</p>
          )}
        </div>

        {/* Create New Organization Form */}
        <div className="p-6 border rounded-lg bg-gray-50 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold mb-4">Create Organization</h2>
          <form action={createOrganization} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Organization Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-3 py-2 border rounded-md bg-transparent"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Create Workspace
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}