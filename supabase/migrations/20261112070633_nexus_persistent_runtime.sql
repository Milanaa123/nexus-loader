-- Private application storage. No user or anonymous Data API access is granted.
create table public.nexus_documents (
  name text primary key check (name in ('queue','progress','processed','results','errors','verification')),
  value jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  mutation uuid,
  updated_at timestamptz not null default now(),
  check (octet_length(value::text) <= 8388608)
);
create table public.nexus_worker_lease (
  name text primary key check (name = 'worker'),
  owner uuid,
  fence bigint not null default 0,
  expires_at timestamptz not null default '-infinity'
);
create table public.nexus_server_credentials (
  name text primary key check (name = 'render'),
  token_sha256 text not null check (token_sha256 ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true
);
create table public.nexus_chunks (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes integer not null check (bytes > 0 and bytes <= 2097152),
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.nexus_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  entry jsonb not null check (octet_length(entry::text) <= 65536)
);
alter table public.nexus_documents enable row level security;
alter table public.nexus_worker_lease enable row level security;
alter table public.nexus_server_credentials enable row level security;
alter table public.nexus_chunks enable row level security;
alter table public.nexus_events enable row level security;
revoke all on public.nexus_documents, public.nexus_worker_lease, public.nexus_server_credentials, public.nexus_chunks, public.nexus_events from public, anon, authenticated;
revoke all on sequence public.nexus_events_id_seq from public, anon, authenticated;
grant select, insert, update on public.nexus_documents, public.nexus_worker_lease, public.nexus_chunks to service_role;
grant select on public.nexus_server_credentials to service_role;
grant select, insert on public.nexus_events to service_role;
grant usage, select on sequence public.nexus_events_id_seq to service_role;

insert into public.nexus_documents(name,value) values
 ('queue','{"version":3,"updatedAt":null,"items":[]}'), ('progress','{}'),
 ('processed','[]'), ('results','[]'), ('errors','[]'), ('verification','{}');
insert into public.nexus_worker_lease(name) values ('worker');

create function public.nexus_document_cas(p_name text, p_revision bigint, p_value jsonb, p_mutation uuid, p_owner uuid default null, p_fence bigint default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_doc public.nexus_documents;
begin
  if p_name not in ('queue','verification') or p_owner is not null then
    -- The row lock makes fencing atomic with the document commit.
    perform 1 from public.nexus_worker_lease
      where name='worker' and owner=p_owner and fence=p_fence and expires_at>clock_timestamp() for update;
    if not found then raise exception 'worker_lease_lost' using errcode='55P03'; end if;
  end if;
  select * into strict current_doc from public.nexus_documents where name=p_name for update;
  if current_doc.mutation=p_mutation then
    if current_doc.value<>p_value then raise exception 'mutation_payload_changed'; end if;
    return to_jsonb(current_doc);
  end if;
  if current_doc.revision<>p_revision then return null; end if;
  update public.nexus_documents set value=p_value,revision=revision+1,mutation=p_mutation,updated_at=clock_timestamp()
    where name=p_name returning * into current_doc;
  return to_jsonb(current_doc);
end $$;

create function public.nexus_lease(p_action text, p_owner uuid, p_fence bigint default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_lease public.nexus_worker_lease;
begin
  select * into strict current_lease from public.nexus_worker_lease where name='worker' for update;
  if p_action='claim' then
    if current_lease.expires_at>clock_timestamp() and current_lease.owner is distinct from p_owner then return null; end if;
    update public.nexus_worker_lease set owner=p_owner,
      fence=case when owner=p_owner and expires_at>clock_timestamp() then fence else fence+1 end,
      expires_at=clock_timestamp()+interval '120 seconds' where name='worker' returning * into current_lease;
  elsif current_lease.owner=p_owner and current_lease.fence=p_fence and current_lease.expires_at>clock_timestamp() then
    if p_action='touch' then
      update public.nexus_worker_lease set expires_at=clock_timestamp()+interval '120 seconds' where name='worker' returning * into current_lease;
    elsif p_action='release' then
      update public.nexus_worker_lease set expires_at=clock_timestamp(),owner=null where name='worker' returning * into current_lease;
    else raise exception 'invalid_lease_action'; end if;
  else return null;
  end if;
  return to_jsonb(current_lease);
end $$;

create function public.nexus_reserve_chunk(p_sha256 text, p_bytes integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item public.nexus_chunks;
begin
  -- Reservations, including interrupted uploads, count towards the 800 MiB safety budget.
  perform pg_catalog.pg_advisory_xact_lock(482190037);
  select * into item from public.nexus_chunks where sha256=p_sha256;
  if found then
    if item.bytes<>p_bytes then raise exception 'chunk_size_mismatch'; end if;
    return to_jsonb(item);
  end if;
  if (select coalesce(sum(bytes),0) from public.nexus_chunks)+p_bytes>838860800 then
    raise exception 'storage_budget_exceeded' using errcode='53100';
  end if;
  insert into public.nexus_chunks(sha256,bytes) values(p_sha256,p_bytes) returning * into item;
  return to_jsonb(item);
end $$;

revoke all on function public.nexus_document_cas(text,bigint,jsonb,uuid,uuid,bigint), public.nexus_lease(text,uuid,bigint), public.nexus_reserve_chunk(text,integer) from public,anon,authenticated;
grant execute on function public.nexus_document_cas(text,bigint,jsonb,uuid,uuid,bigint), public.nexus_lease(text,uuid,bigint), public.nexus_reserve_chunk(text,integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('nexus-artifacts','nexus-artifacts',false,2097152,array['application/octet-stream']);
