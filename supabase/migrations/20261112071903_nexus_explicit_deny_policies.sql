-- These server-only tables deliberately do not expose any rows to client roles.
create policy nexus_documents_no_client_access on public.nexus_documents for all to anon, authenticated using (false) with check (false);
create policy nexus_lease_no_client_access on public.nexus_worker_lease for all to anon, authenticated using (false) with check (false);
create policy nexus_credentials_no_client_access on public.nexus_server_credentials for all to anon, authenticated using (false) with check (false);
create policy nexus_chunks_no_client_access on public.nexus_chunks for all to anon, authenticated using (false) with check (false);
create policy nexus_events_no_client_access on public.nexus_events for all to anon, authenticated using (false) with check (false);
