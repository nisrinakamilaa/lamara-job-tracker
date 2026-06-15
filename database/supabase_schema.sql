-- Lamara Supabase schema
-- Run this in Supabase SQL Editor after creating the project.

create table if not exists public.jobs (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    url text default '',
    title text not null default '',
    company text not null default '',
    status text not null default 'applied',
    assessment_type text default '',
    date date not null default current_date,
    location text default '',
    platform text default '',
    priority text not null default 'Medium',
    deadline date,
    follow_up date,
    reminder_notes text default '',
    desc_summary text default '',
    cv_version text default '',
    salary text default '',
    interview_notes text default '',
    notes text default '',
    outreach_status text not null default 'not-contacted',
    outreach_person text default '',
    outreach_date date,
    outreach_url text default '',
    status_history jsonb not null default '[]'::jsonb,
    has_cv_file boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.jobs add column if not exists outreach_status text not null default 'not-contacted';
alter table public.jobs add column if not exists outreach_person text default '';
alter table public.jobs add column if not exists outreach_date date;
alter table public.jobs add column if not exists outreach_url text default '';
alter table public.jobs add column if not exists assessment_type text default '';

alter table public.jobs enable row level security;

drop policy if exists "Users can read their own jobs" on public.jobs;
create policy "Users can read their own jobs"
on public.jobs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
on public.jobs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs"
on public.jobs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
on public.jobs for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();
