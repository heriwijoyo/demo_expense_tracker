import { login, signup } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-20 mx-auto">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
        <label className="text-md" htmlFor="email">Email</label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md" htmlFor="password">Password</label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button formAction={login} className="bg-blue-600 text-white rounded-md px-4 py-2 mb-2">
          Sign In
        </button>
        <button formAction={signup} className="border border-foreground/20 rounded-md px-4 py-2 mb-2">
          Sign Up
        </button>
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-foreground/10 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}