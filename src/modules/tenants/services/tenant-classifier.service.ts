/**
 * Tenant Classifier — Clasificación MIC y Régimen IRE.
 *
 * Algoritmos de clasificación automática según parámetros del
 * Ministerio de Industria y Comercio (MIC) del Paraguay.
 *
 *   MICRO     → ingresos ≤ 500.000.000 Gs. Y personal ≤ 10
 *   PEQUENIA  → ingresos ≤ 5.000.000.000 Gs. Y personal ≤ 30
 *   MEDIANA   → ingresos ≤ 20.000.000.000 Gs. Y personal ≤ 100
 *   GRANDE    → ingresos > 20.000.000.000 Gs. O personal > 100
 *
 * @module tenants/services/tenant-classifier.service
 */

// ─── Umbrales MIC ──────────────────────────────

const UMBRALES_MIC = [
  { maxIngresos: 500_000_000, maxPersonal: 10, clase: "MICRO" as const },
  { maxIngresos: 5_000_000_000, maxPersonal: 30, clase: "PEQUENIA" as const },
  { maxIngresos: 20_000_000_000, maxPersonal: 100, clase: "MEDIANA" as const },
] as const;

/** Retorna la clasificación MIC dado ingresos anuales y personal */
export function clasificarMIC(
  ingresosAnuales: number,
  cantidadPersonal: number,
): "MICRO" | "PEQUENIA" | "MEDIANA" | "GRANDE" {
  for (const umbral of UMBRALES_MIC) {
    if (ingresosAnuales <= umbral.maxIngresos && cantidadPersonal <= umbral.maxPersonal) {
      return umbral.clase;
    }
  }
  return "GRANDE";
}

/**
 * Determina el régimen IRE según la clasificación MIC.
 *
 *   GRANDE + MEDIANA → IRE_GENERAL
 *   PEQUENIA          → IRE_SIMPLE
 *   MICRO             → IRE_RESIMPLE
 */
export function determinarRegimenIRE(
  clasificacion: "MICRO" | "PEQUENIA" | "MEDIANA" | "GRANDE",
): "IRE_GENERAL" | "IRE_SIMPLE" | "IRE_RESIMPLE" {
  switch (clasificacion) {
    case "GRANDE":
    case "MEDIANA":
      return "IRE_GENERAL";
    case "PEQUENIA":
      return "IRE_SIMPLE";
    case "MICRO":
      return "IRE_RESIMPLE";
  }
}

/**
 * Activa los libros obligatorios según forma jurídica y régimen IRE.
 *
 * Retorna el array de { libro, obligatorio } para insertar en
 * libros_obligatorios.
 */
export function activarLibrosObligatorios(
  formaJuridica: string,
  regimenIre: string,
): Array<{ libro: string; obligatorio: boolean }> {
  const libros: Array<{ libro: string; obligatorio: boolean }> = [];

  // Libros según régimen IRE
  switch (regimenIre) {
    case "IRE_GENERAL":
      libros.push(
        { libro: "DIARIO", obligatorio: true },
        { libro: "MAYOR", obligatorio: true },
        { libro: "INVENTARIO", obligatorio: true },
      );
      // Libros societarios según forma jurídica
      if (["SA", "SAECA", "EAS"].includes(formaJuridica)) {
        libros.push(
          { libro: "ACTAS_ASAMBLEA", obligatorio: true },
          { libro: "REGISTRO_ACCIONES", obligatorio: true },
        );
      }
      if (formaJuridica === "SRL") {
        libros.push({ libro: "REGISTRO_SOCIOS", obligatorio: true });
      }
      break;

    case "IRE_SIMPLE":
      libros.push(
        { libro: "COMPRAS_VENTAS_SIMPLE", obligatorio: true },
      );
      break;

    case "IRE_RESIMPLE":
      libros.push(
        { libro: "INGRESOS_EGRESOS_RESIMPLE", obligatorio: true },
      );
      break;
  }

  return libros;
}
