# Deployment Checklist — AutomotiveOS Cloud ERP

## Pre-Deployment

### Environment Variables
- [ ] `DATABASE_URL` — Supabase PostgreSQL connection string
- [ ] `SUPABASE_URL` — Supabase project URL
- [ ] `SUPABASE_ANON_KEY` — Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- [ ] `SUPABASE_JWT_SECRET` — Supabase JWT secret
- [ ] `TECDOC_API_KEY` — TecDoc API key (optional)
- [ ] `OPENAI_API_KEY` — OpenAI API key (optional)

### Database
- [ ] Run migration `0022_sprint34_new_tables.sql`
  ```bash
  npx tsx src/shared/database/run-migrations.ts
  ```
- [ ] Verify tables created:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```
- [ ] Verify RLS policies active:
  ```sql
  SELECT schemaname, tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public';
  ```

### Storage
- [ ] Run storage setup:
  ```bash
  npx tsx src/shared/database/setup-storage.ts
  ```
- [ ] Verify buckets created:
  - `dvi-photos` (private, 10MB limit)

### Application
- [ ] Build TypeScript:
  ```bash
  npx tsc --noEmit
  ```
- [ ] Run full test suite:
  ```bash
  npx vitest run
  ```
- [ ] Verify 707+ tests passing

## Deployment

### Start Server
```bash
node dist/server.js
```

### Health Check
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","database":"connected",...}`

### API Smoke Test
```bash
npx tsx src/shared/database/api-smoke-test.ts --base-url http://localhost:3000
```
Expected: All tests pass (16+ endpoints)

## Post-Deployment Verification

### Critical Paths
- [ ] Login flow: `POST /api/auth/login`
- [ ] Dashboard loads: `GET /dashboard`
- [ ] Work orders list: `GET /workshop/ordenes`
- [ ] DVI inspection: `GET /dvi`
- [ ] Calendar: `GET /scheduling/appointments`
- [ ] Marketing: `GET /marketing/campaigns`
- [ ] Fleet: `GET /fleet`

### RBAC
- [ ] Admin sees all views
- [ ] Manager sees 15 views
- [ ] Mechanic sees 10 views
- [ ] User sees 2 views (dashboard, tv)

### Offline Sync
- [ ] PWA registers service worker
- [ ] Sync status indicator shows online
- [ ] Offline queue processes when back online

### Memory
- [ ] RSS < 50MB
- [ ] Heap < 30MB

## Rollback Plan

If issues detected:
1. Stop server
2. Revert to previous deployment
3. Database is backwards-compatible (new tables only)
4. Frontend is static files (revert if needed)

## Monitoring

### Key Metrics
- Response time < 200ms (p95)
- Error rate < 1%
- Memory RSS < 50MB
- Database connections < 10

### Logs
- Check `stdout` for startup errors
- Check `/health` for database status
- Check `/health/live` for liveness

## Support

### Common Issues
1. **Database connection fails**: Check `DATABASE_URL`, verify Supabase is running
2. **RLS blocks queries**: Verify `X-Tenant-Slug` header is set
3. **Storage upload fails**: Run `setup-storage.ts`, check bucket policies
4. **Memory exceeds 50MB**: Check for memory leaks, restart server

### Contacts
- Admin: jaraju01@gmail.com
- Tenant: taller-el-chero
