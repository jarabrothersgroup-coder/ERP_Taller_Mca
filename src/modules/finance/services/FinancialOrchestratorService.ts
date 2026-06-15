import { getDb } from "../../../shared/database/connection.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

const LABOR_SHARE = 0.6;

/**
 * Validates a tenant slug contains only safe characters.
 * Throws ValidationError if invalid characters are detected.
 * Prevents SQL injection through schema name interpolation.
 */
export function validateTenantSchema(slug: string): string {
  if (!slug || typeof slug !== "string") {
    throw new ValidationError("Tenant slug debe ser un string no vacío");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(slug)) {
    throw new ValidationError(
      `Tenant slug contiene caracteres inválidos: "${slug}". Solo se permiten letras, números y guiones bajos.`,
    );
  }
  return slug;
}

function tenantSchema(slug: string): string {
  validateTenantSchema(slug);
  return `tenant_${slug}`;
}

export async function calculateMonthlyCommissions(
  slug: string,
  month: number,
  year: number,
): Promise<{ created: number }> {
  const db = getDb();
  const tSchema = tenantSchema(slug);

  const [tenant] = await db`SELECT id FROM public.tenants WHERE slug = ${slug}`;
  if (!tenant) throw new NotFoundError("Tenant no encontrado");

  const orders = await db`
    SELECT o.id, o.total_cost
    FROM ${db(tSchema)}.work_orders o
    WHERE o.status IN ('completed', 'Listo')
      AND EXTRACT(MONTH FROM o.updated_at) = ${month}
      AND EXTRACT(YEAR FROM o.updated_at) = ${year}
  `;

  const [profiles] = await db`
    SELECT mp.id, mp.commission_rate, p.id as profile_id
    FROM public.mechanic_profiles mp
    JOIN public.profiles p ON p.id = mp.profile_id
    WHERE p.tenant_id = ${tenant.id} AND p.is_active = true
    ORDER BY mp.created_at ASC
    LIMIT 1
  `;

  if (!profiles) return { created: 0 };

  let created = 0;
  for (const order of orders) {
    const totalCost = parseFloat(order.total_cost || "0");
    if (totalCost <= 0) continue;

    const laborAmount = Math.round(totalCost * LABOR_SHARE);
    const rate = parseFloat(profiles.commission_rate || "0");
    const commissionAmount = Math.round(laborAmount * (rate / 100));

    const [existing] = await db`
      SELECT id FROM public.commission_records
      WHERE tenant_id = ${tenant.id} AND order_id = ${order.id} AND month = ${month} AND year = ${year}
    `;
    if (existing) continue;

    await db`
      INSERT INTO public.commission_records
        (tenant_id, order_id, mechanic_profile_id, labor_amount, commission_rate, commission_amount, status, month, year)
      VALUES
        (${tenant.id}, ${order.id}, ${profiles.id}, ${laborAmount}, ${rate.toString()}, ${commissionAmount}, 'EN_ESPERA_DE_UMBRAL', ${month}, ${year})
    `;
    created++;
  }

  return { created };
}

export async function checkWorkshopEquilibrium(
  slug: string,
  month: number,
  year: number,
): Promise<{
  breakevenHit: boolean;
  breakevenPercentage: number;
  netLaborRevenue: number;
  totalThreshold: number;
  amountRemaining: number;
  commissionsLiberated: number;
}> {
  const db = getDb();
  const tSchema = tenantSchema(slug);

  const [tenant] = await db`SELECT id FROM public.tenants WHERE slug = ${slug}`;
  if (!tenant) throw new NotFoundError("Tenant no encontrado");
  const tenantId = tenant.id;

  const [fixedSum] = await db`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM public.fixed_expenses
    WHERE tenant_id = ${tenantId} AND month = ${month} AND year = ${year}
  `;
  const fixedExpensesTotal = parseInt(String(fixedSum?.total || "0"), 10);

  const [mechSalSum] = await db`
    SELECT COALESCE(SUM(mp.base_salary), 0) as total
    FROM public.mechanic_profiles mp
    JOIN public.profiles p ON p.id = mp.profile_id
    WHERE p.tenant_id = ${tenantId} AND p.is_active = true
  `;

  const [staffSalSum] = await db`
    SELECT COALESCE(SUM(sp.base_salary), 0) as total
    FROM public.staff_profiles sp
    JOIN public.profiles p ON p.id = sp.profile_id
    WHERE p.tenant_id = ${tenantId} AND p.is_active = true
  `;

  const mechBase = parseInt(String(mechSalSum?.[0]?.total || "0"), 10);
  const staffBase = parseInt(String(staffSalSum?.[0]?.total || "0"), 10);
  const payrollBaseTotal = mechBase + staffBase;
  const totalThreshold = fixedExpensesTotal + payrollBaseTotal;

  const [revenue] = await db`
    SELECT COALESCE(SUM(CAST(o.total_cost AS NUMERIC)), 0) as total
    FROM ${db(tSchema)}.work_orders o
    WHERE o.status IN ('completed', 'Listo')
      AND EXTRACT(MONTH FROM o.updated_at) = ${month}
      AND EXTRACT(YEAR FROM o.updated_at) = ${year}
  `;

  const grossRevenue = Math.round(parseFloat(String(revenue?.total || "0")));
  const partsCost = Math.round(grossRevenue * (1 - LABOR_SHARE));
  const netLaborRevenue = grossRevenue - partsCost;

  const breakevenHit = netLaborRevenue >= totalThreshold;
  const breakevenPercentage = totalThreshold > 0
    ? Math.round((netLaborRevenue / totalThreshold) * 10000) / 100
    : 0;

  let commissionsLiberated = 0;
  if (breakevenHit) {
    const result = await db`
      UPDATE public.commission_records
      SET status = 'LIBERADO', updated_at = NOW()
      WHERE tenant_id = ${tenantId} AND month = ${month} AND year = ${year} AND status = 'EN_ESPERA_DE_UMBRAL'
      RETURNING id
    `;
    commissionsLiberated = result.length;
  }

  const [existing] = await db`
    SELECT id FROM public.payroll_summary
    WHERE tenant_id = ${tenantId} AND month = ${month} AND year = ${year}
  `;

  const pctStr = breakevenPercentage.toFixed(2);
  if (existing) {
    await db`
      UPDATE public.payroll_summary
      SET fixed_expenses_total = ${fixedExpensesTotal},
          payroll_base_total = ${payrollBaseTotal},
          net_labor_revenue = ${netLaborRevenue},
          breakeven_threshold = ${totalThreshold},
          breakeven_hit = ${breakevenHit},
          breakeven_percentage = ${pctStr}
      WHERE id = ${existing.id}
    `;
  } else {
    await db`
      INSERT INTO public.payroll_summary
        (tenant_id, month, year, fixed_expenses_total, payroll_base_total, net_labor_revenue, breakeven_threshold, breakeven_hit, breakeven_percentage)
      VALUES
        (${tenantId}, ${month}, ${year}, ${fixedExpensesTotal}, ${payrollBaseTotal}, ${netLaborRevenue}, ${totalThreshold}, ${breakevenHit}, ${pctStr})
    `;
  }

  return {
    breakevenHit,
    breakevenPercentage,
    netLaborRevenue,
    totalThreshold,
    amountRemaining: Math.max(0, totalThreshold - netLaborRevenue),
    commissionsLiberated,
  };
}

export async function getBreakevenProgress(
  slug: string,
): Promise<{
  percentage: number;
  currentRevenue: number;
  threshold: number;
  remaining: number;
  breakevenHit: boolean;
  month: number;
  year: number;
}> {
  const db = getDb();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [tenant] = await db`SELECT id FROM public.tenants WHERE slug = ${slug}`;
  if (!tenant) throw new NotFoundError("Tenant no encontrado");

  const [summary] = await db`
    SELECT * FROM public.payroll_summary
    WHERE tenant_id = ${tenant.id} AND month = ${month} AND year = ${year}
    ORDER BY created_at DESC LIMIT 1
  `;

  if (summary) {
    const pct = parseFloat(String(summary.breakeven_percentage || "0"));
    return {
      percentage: pct,
      currentRevenue: summary.net_labor_revenue,
      threshold: summary.breakeven_threshold,
      remaining: Math.max(0, summary.breakeven_threshold - summary.net_labor_revenue),
      breakevenHit: summary.breakeven_hit,
      month,
      year,
    };
  }

  const result = await checkWorkshopEquilibrium(slug, month, year);
  return {
    percentage: result.breakevenPercentage,
    currentRevenue: result.netLaborRevenue,
    threshold: result.totalThreshold,
    remaining: result.amountRemaining,
    breakevenHit: result.breakevenHit,
    month,
    year,
  };
}
