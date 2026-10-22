# Engineering Notes: CI/CD Best Practices

## Deployment Strategies

### Rolling Update
Replace instances one at a time. Zero downtime.
Risk: Incompatible DB schema changes during rollout (old + new code coexist).

### Blue/Green Deployment
Two identical environments (Blue = live, Green = new version).
Switch traffic instantly. Easy rollback by switching back.
Cost: Double infrastructure during switch.

### Canary Deployment
Route 5% of traffic to new version. Gradually increase.
Monitor error rates. Roll back if metrics degrade.
Best for: High-traffic systems where silent regressions are costly.

## Pre-Deployment Checklist

- [ ] All tests pass (unit, integration, E2E)
- [ ] No secrets committed to git
- [ ] Database migrations are backward-compatible
- [ ] Feature flags are configured
- [ ] Rollback plan is documented
- [ ] Monitoring alerts are set up
- [ ] Stakeholders notified

## Database Migration Safety

1. Never DROP COLUMN or RENAME COLUMN in the same deploy as the code that stops using it.
2. Use the expand/contract pattern:
   - Step 1: Add new column (nullable) — deploy code that writes to both
   - Step 2: Backfill old data
   - Step 3: Add NOT NULL constraint
   - Step 4: Remove old column in a later deploy

## Rollback Playbook

```bash
# Revert to previous Vercel deployment
vercel rollback [deployment-url]

# Revert last database migration
npm run db:migrate:rollback

# Check service health after rollback
curl https://api.example.com/health
```
