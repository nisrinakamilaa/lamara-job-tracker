-- Add generalized assessment support to an existing Lamara database.

alter table public.jobs
add column if not exists assessment_type text default '';

update public.jobs
set
    status = 'assessment',
    assessment_type = case
        when coalesce(assessment_type, '') = '' then 'Psychometric Test'
        else assessment_type
    end
where status = 'psychotest';
