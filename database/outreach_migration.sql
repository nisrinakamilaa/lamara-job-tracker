alter table public.jobs add column if not exists outreach_status text not null default 'not-contacted';
alter table public.jobs add column if not exists outreach_person text default '';
alter table public.jobs add column if not exists outreach_date date;
alter table public.jobs add column if not exists outreach_url text default '';
