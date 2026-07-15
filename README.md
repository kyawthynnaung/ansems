# ANSEMS Static Site

Static NFT project site with a Vercel serverless endpoint for WL submissions.

## Database Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. Add these environment variables in Vercel:

```text
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The WL form submits to `/api/wl-entry` and stores entries in `public.wl_entries`.

## Admin Raffle

Run the full `supabase-schema.sql` file again after this update. It adds:

- `public.wl_raffles`
- `public.wl_winners`

Add one more Vercel production environment variable:

```text
ADMIN_KEY=choose_a_private_admin_password
```

Admin page:

```text
/admin.html
```

The admin page can load WL entries, draw raffle winners, and save final winners into `public.wl_winners`.
