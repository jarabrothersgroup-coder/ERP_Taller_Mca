/**
 * AI DTC Assistant Service — LLM-powered diagnostic suggestions.
 *
 * Analyzes DTC codes from Thinkcar/Launch scanners and provides
 * intelligent repair suggestions using OpenAI GPT-4o-mini.
 *
 * Cost: ~$0.001-0.005 per query (very low for workshops).
 *
 * @module intelligence/services/ai-dtc-assistant.service
 */

import { env } from "../../../config/env.js";

// ─── Types ────────────────────────────────────

export interface DTCDiagnosis {
  codigo: string;
  descripcion: string;
  vehiculo: string;
  kilometraje?: number;
}

export interface DiagnosticSuggestion {
  codigo: string;
  causaProbable: string;
  porcentajeConfianza: number;
  repuestosNecesarios: string[];
  tiempoEstimadoHoras: number;
  costoEstimado: number;
  serviciosRelacionados: string[];
  recomendaciones: string;
}

export interface AIAssistantResponse {
  success: boolean;
  suggestions: DiagnosticSuggestion[];
  modelo: string;
  tokensUsados: number;
  costoEstimadoUSD: number;
}

// ─── OpenAI Integration ───────────────────────

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Analyzes DTC codes and provides diagnostic suggestions.
 *
 * @param diagnostico - DTC diagnosis data
 * @returns AI-powered suggestions
 */
export async function analyzeDTCs(
  diagnostico: DTCDiagnosis,
): Promise<AIAssistantResponse> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    // Fallback: return basic suggestions without AI
    return {
      success: false,
      suggestions: getBasicSuggestions(diagnostico.codigo),
      modelo: "fallback-local",
      tokensUsados: 0,
      costoEstimadoUSD: 0,
    };
  }

  const prompt = buildPrompt(diagnostico);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres un mecánico automotriz experto paraguayo con 20 años de experiencia.
            Analizas códigos DTC (Diagnostic Trouble Codes) y proporcionas sugerencias precisas.
            Respondes en español paraguayo.
            Tu respuesta debe ser JSON válido con el siguiente formato:
            {
              "causaProbable": "descripción",
              "porcentajeConfianza": 85,
              "repuestosNecesarios": ["repuesto1", "repuesto2"],
              "tiempoEstimadoHoras": 2.5,
              "costoEstimado": 500000,
              "serviciosRelacionados": ["servicio1"],
              "recomendaciones": "texto libre"
            }`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const tokens = data.usage?.total_tokens || 0;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        suggestions: [
          {
            codigo: diagnostico.codigo,
            ...parsed,
          },
        ],
        modelo: "gpt-4o-mini",
        tokensUsados: tokens,
        costoEstimadoUSD: tokens * 0.00000015, // $0.15 per 1M tokens
      };
    }

    return {
      success: false,
      suggestions: getBasicSuggestions(diagnostico.codigo),
      modelo: "gpt-4o-mini",
      tokensUsados: tokens,
      costoEstimadoUSD: 0,
    };
  } catch (err) {
    console.warn("[ai-dtc-assistant] Error calling OpenAI:", err);
    return {
      success: false,
      suggestions: getBasicSuggestions(diagnostico.codigo),
      modelo: "fallback-local",
      tokensUsados: 0,
      costoEstimadoUSD: 0,
    };
  }
}

/**
 * Builds the prompt for DTC analysis.
 */
function buildPrompt(diagnostico: DTCDiagnosis): string {
  return `Analiza el siguiente código DTC y proporciona sugerencias de diagnóstico:

Código DTC: ${diagnostico.codigo}
Descripción: ${diagnostico.descripcion}
Vehículo: ${diagnostico.vehiculo}
${diagnostico.kilometraje ? `Kilometraje: ${diagnostico.kilometraje} km` : ""}

Basado en tu experiencia con vehículos en Paraguay, proporciona:
1. Causa más probable (con % de confianza)
2. Repuestos necesarios (específicos para el mercado paraguayo)
3. Tiempo estimado de reparación
4. Costo estimado en Guaraníes
5. Servicios relacionados preventivos
6. Recomendaciones adicionales`;
}

/**
 * Basic fallback suggestions when AI is not available.
 */
function getBasicSuggestions(codigo: string): DiagnosticSuggestion[] {
  const suggestions: Record<string, Partial<DiagnosticSuggestion>> = {
    P0300: {
      causaProbable: "Misfire aleatorio — posible problema de bujías, bobinas o inyectores",
      repuestosNecesarios: ["Bujías", "Bobinas de encendido", "Inyectores"],
      tiempoEstimadoHoras: 3,
      costoEstimado: 350000,
    },
    P0171: {
      causaProbable: "Mezcla pobre — posible fuga de vacío o sensor MAF sucio",
      repuestosNecesarios: ["Sensor MAF", "Juntas de admisión"],
      tiempoEstimadoHoras: 2,
      costoEstimado: 250000,
    },
    P0420: {
      causaProbable: "Eficiencia del catalizador bajo el umbral",
      repuestosNecesarios: ["Convertidor catalítico", "Sensor O2"],
      tiempoEstimadoHoras: 2.5,
      costoEstimado: 800000,
    },
    P0700: {
      causaProbable: "Fallo en transmisión — requiere escaneo específico",
      repuestosNecesarios: ["Líquido de transmisión", "Sensor de velocidad"],
      tiempoEstimadoHoras: 4,
      costoEstimado: 500000,
    },
  };

  const suggestion = suggestions[codigo] || {
    causaProbable: `Código ${codigo} — requiere diagnóstico visual y escaneo`,
    repuestosNecesarios: ["A determinar tras diagnóstico"],
    tiempoEstimadoHoras: 2,
    costoEstimado: 200000,
  };

  return [
    {
      codigo,
      causaProbable: suggestion.causaProbable || "",
      porcentajeConfianza: 60,
      repuestosNecesarios: suggestion.repuestosNecesarios || [],
      tiempoEstimadoHoras: suggestion.tiempoEstimadoHoras || 2,
      costoEstimado: suggestion.costoEstimado || 200000,
      serviciosRelacionados: ["Diagnóstico computarizado"],
      recomendaciones: "Se recomienda verificación visual y escaneo completo",
    },
  ];
}
