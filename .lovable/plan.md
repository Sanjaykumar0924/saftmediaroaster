## Scope

Improvements to the existing SAFT Media Team app. No architectural rebuild — keep TanStack Start, Supabase, existing route tree, and tables. Add columns/policies as needed, layer realtime subscriptions on existing queries, and refine UI.

## 1. Draft → Publish roster workflow (highest priority)

**DB migration** (adds to existing `roster` table):
- Add `status` column: `text NOT NULL DEFAULT 'draft'` with CHECK in (`draft`,`published`).
- Add `published_at timestamptz`.
- Update RLS on `roster`:
  - Members: `SELECT` only when `status = 'published'`.
  - Admins (`has_role`): full access.
- Enable realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.roster, public.availability, public.notifications, public.announcements, public.profiles;`
- Set `REPLICA IDENTITY FULL` on the same tables so UPDATE payloads carry old row data.

**Admin build page** (`admin/roster.tsx`):
- "Save Draft" (writes rows with `status='draft'`) and "Publish" (upserts rows with `status='published'`, `published_at=now()`, then inserts notifications).
- Status badge on the current service.

**Member roster view** (`_authenticated/roster.tsx`):
- Filter `status='published'`.
- Split into three tabs/sections: Current Week, Upcoming, Previous (past 60 days).
- Subscribe to `postgres_changes` on `roster` and `notifications`; on any change, invalidate roster + notification queries and show a toast "📢 A new roster has been published for {service}".

## 2. Realtime everywhere

Add a small `useRealtimeInvalidate(table, queryKeys[])` hook. Wire in:
- Dashboard: roster, availability, notifications, announcements.
- Availability page: availability (own rows).
- Admin members: profiles.
- Admin attendance: attendance.
- Notification bell (in AppShell): notifications for current user.

Single subscription per table per mounted page, cleaned up on unmount.

## 3. Availability page redesign

- Full-width card per service with stacked, equal-width, rounded `Available` (green) / `Not Available` (red) buttons, min-h-14, smooth hover/selected state, clear icon.
- Auto-save on click (already does — keep, add optimistic update + realtime broadcast).
- Mobile: single column, generous spacing.

## 4. Password change + member profile

New route `_authenticated/settings.tsx`:
- **Change Password**: current, new, confirm. Verify current via `supabase.auth.signInWithPassword({ email, password: current })`, then `supabase.auth.updateUser({ password: new })`. Show/hide toggles, zod validation (min 8, upper+lower+digit).
- **Profile**: phone, photo upload (to new `avatars` storage bucket, public), display-only for name/role. Name field disabled with tooltip "Contact admin to change".

Add link in AppShell user menu.

## 5. Admin member management

Enhance `admin/members.tsx`:
- Add/Edit dialog (full_name, username, phone, role_title, active).
- Reset Password: prompts new password, calls a `createServerFn` using `supabaseAdmin.auth.admin.updateUserById`.
- Upload profile photo (avatars bucket).
- Activate/Deactivate toggle.
- Delete with confirmation dialog (server fn: `auth.admin.deleteUser` + cascade via FK).

Server functions live in `src/lib/admin.functions.ts` (already exists) gated by `requireSupabaseAuth` + admin role check.

## 6. Mobile responsive pass

- AppShell sidebar → shadcn `Sidebar` with `collapsible="offcanvas"` on mobile via `useIsMobile`; hamburger `SidebarTrigger` in header.
- Dashboard grids: `grid-cols-1 md:grid-cols-3`.
- Tables: wrap in `overflow-x-auto`.
- Buttons: ensure `min-h-11` on primary touch targets.
- Dialogs: `max-w-[95vw]` on mobile.
- Fix header rows per responsive-layout-patterns knowledge.

## 7. UI polish

- Consistent SAFT palette (red primary, white, dark gray, black) — verify tokens in `styles.css`.
- Skeleton loaders on dashboard/roster loading.
- Empty state components.
- Toast for every mutation.

## Technical notes

- Use `supabase.channel().on('postgres_changes', {event:'*', schema:'public', table:'roster', filter:'status=eq.published'}, ...)` for member subscriptions.
- Roster subscription callback: `queryClient.invalidateQueries({ queryKey: ['all-upcoming-roster'] })` + notification toast if event is INSERT/UPDATE with new status='published'.
- Storage bucket `avatars` (public) created via `supabase--storage_create_bucket`.
- No changes to auto-generated files (`client.ts`, `types.ts`, `auth-middleware.ts`).

## Out of scope

- Rewriting existing tables or auth flow.
- Renaming routes.
- Analytics/attendance beyond realtime hookup.

Approve and I'll ship it in order: migration → realtime → roster workflow → availability redesign → settings/password → admin members → mobile polish.