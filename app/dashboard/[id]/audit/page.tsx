// NEW ADDITION: Entirely new file for the Audit Log UI
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import Link from 'next/link'

export default async function AuditLogPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the audit logs. 
  // RLS ensures ONLY admins of this org_id will get rows back!
  const { data: logs, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  if (error) console.error("Audit fetch error:", error)

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6">
      <div className="mb-6">
        <Link href={`/dashboard/${id}`} className="text-blue-500 hover:underline text-sm">
          &larr; Back to Workspace
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Security Audit Log</h1>
      <p className="text-gray-500 mb-6">
        Immutable record of all database changes. Powered by Postgres Triggers.
      </p>

      {logs && logs.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 dark:bg-zinc-800">
              <tr>
                <th className="p-3 border-b">Timestamp</th>
                <th className="p-3 border-b">Action</th>
                <th className="p-3 border-b">Record ID</th>
                <th className="p-3 border-b">Diff</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900">
                  <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-500">
                    {log.record_id?.split('-')[0]}...
                  </td>
                  <td className="p-3 text-xs overflow-x-auto max-w-xs">
                    {/* Displaying raw JSON for the tech demo aesthetic */}
                    <pre className="bg-gray-100 dark:bg-black p-2 rounded">
                      {JSON.stringify(log.after_data || log.before_data, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 border rounded-md p-8 text-center border-dashed">
          No audit logs found, or you do not have admin permissions to view them.
        </p>
      )}
    </div>
  )
}