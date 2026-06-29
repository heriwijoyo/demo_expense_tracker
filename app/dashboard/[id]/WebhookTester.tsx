'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WebhookTester({ orgId }: { orgId: string }) {
  const router = useRouter()
  // Generate a fixed ID for the current test session so we can simulate retries
  const [webhookId, setWebhookId] = useState(crypto.randomUUID())
  const [logs, setLogs] = useState<{ time: string; status: number; message: string }[]>([])
  const [isFiring, setIsFiring] = useState(false)

  const fireWebhook = async () => {
    setIsFiring(true)
    try {
      // In production, this would be your hosted Supabase Edge Function URL
    //   const url = process.env.NODE_ENV === 'development' 
    //     ? 'http://127.0.0.1:54321/functions/v1/topup-webhook'
    //     : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/topup-webhook`
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/topup-webhook`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_id: webhookId,
          org_id: orgId,
          amount: 500.00
        }),
      })

      const data = await res.json()
      
      setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        status: res.status,
        message: data.message || data.error
      }, ...prev])

      // Tell Next.js to refresh the server components to update the Wallet UI
      router.refresh()
      
    } catch (err: any) {
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), status: 500, message: err.message }, ...prev])
    }
    setIsFiring(false)
  }

  const resetWebhook = () => {
    setWebhookId(crypto.randomUUID())
    setLogs([])
  }

  return (
    <div className="col-span-1 md:col-span-3 p-6 border rounded-lg border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900 mt-8">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300">Idempotency Tester</h2>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            Simulate a payment gateway sending a $500 top-up. Click "Fire" multiple times to test network retries.
          </p>
        </div>
        <button onClick={resetWebhook} className="text-xs bg-white dark:bg-zinc-800 border px-3 py-1.5 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700">
          Generate New ID
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 p-4 rounded-md border font-mono text-sm mb-4 overflow-x-auto">
        <span className="text-gray-500">Payload: </span>
        {`{"webhook_id": "${webhookId.split('-')[0]}...", "amount": 500.00}`}
      </div>

      <button 
        onClick={fireWebhook} 
        disabled={isFiring}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors mb-4 disabled:opacity-50"
      >
        {isFiring ? 'Sending...' : '🔥 Fire Webhook Payload'}
      </button>

      {logs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Server Responses:</h3>
          {logs.map((log, i) => (
            <div key={i} className={`p-3 rounded border text-sm ${log.status === 200 && log.message.includes('Funds added') ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20' : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20'}`}>
              <span className="font-bold opacity-70 mr-2">[{log.time}]</span>
              <span className="font-bold mr-2">{log.status}</span>
              {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}