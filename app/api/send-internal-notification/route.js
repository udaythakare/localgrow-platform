// app/api/notifications/route.ts
import { getUser, getUserId } from '@/helpers/userHelper'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for server-side operations
)

// GET - Fetch user notifications
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const rawUserId = await getUserId();
    const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

    if (!userId) {
      return NextResponse.json({ notifications: [] }, { status: 200 })
    }

    let query = supabase
      .from('internal_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new notification
export async function POST(request) {
  try {
    const body = await request.json()
    const { message, title, type = 'info' } = body

    const rawUserId = await getUserId();
    const user_id = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

    if (!message || !user_id) {
      return NextResponse.json({ error: 'Message and user_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('internal_notifications')
      .insert([{ message, user_id, title, type }])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notification: data[0] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Mark notification as read
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { notificationId, markAllAsRead } = body
    const rawUserId = await getUserId();
    const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (markAllAsRead) {
      const { error } = await supabase
        .from('internal_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('internal_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}