import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { user_id, password } = await request.json()

  if (!user_id || !password) {
    return NextResponse.json({ error: 'user_id et password requis' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
