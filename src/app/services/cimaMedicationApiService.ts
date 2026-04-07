export interface SugerenciaMedicamentoCima {
  id: string;
  nombre: string;
  dosis: string;
  tipoCajaSugerido: string;
}

interface CimaMedicamentoRespuesta {
  nregistro: string;
  nombre: string;
  dosis?: string;
  formaFarmaceutica?: {
    nombre?: string;
  };
  formaFarmaceuticaSimplificada?: {
    nombre?: string;
  };
}

interface CimaBusquedaRespuesta {
  resultados?: CimaMedicamentoRespuesta[];
}

const CIMA_ENDPOINT = "https://cima.aemps.es/cima/rest/medicamentos";

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function construirTipoCajaSugerido(item: CimaMedicamentoRespuesta): string {
  const forma = item.formaFarmaceutica?.nombre ?? item.formaFarmaceuticaSimplificada?.nombre ?? "";
  if (!forma) {
    return "Presentacion sin especificar";
  }
  return forma;
}

function mapear(item: CimaMedicamentoRespuesta): SugerenciaMedicamentoCima {
  return {
    id: item.nregistro,
    nombre: item.nombre,
    dosis: item.dosis ?? "Dosis no especificada",
    tipoCajaSugerido: construirTipoCajaSugerido(item),
  };
}

function calcularRelevancia(item: SugerenciaMedicamentoCima, consultaNormalizada: string): number {
  const nombreNormalizado = normalizarTexto(item.nombre);
  
  // Exacta al inicio: máxima relevancia
  if (nombreNormalizado.startsWith(consultaNormalizada)) {
    return 3;
  }
  
  // Palabra exacta dentro: relevancia alta
  const palabras = nombreNormalizado.split(/\s+/);
  if (palabras.some(p => p.startsWith(consultaNormalizada))) {
    return 2;
  }
  
  // Contiene la consulta: relevancia media
  if (nombreNormalizado.includes(consultaNormalizado)) {
    return 1;
  }
  
  return 0;
}

export const cimaMedicationApiService = {
  async buscarPorNombre(nombre: string): Promise<SugerenciaMedicamentoCima[]> {
    const consulta = nombre.trim();
    if (consulta.length < 3) {
      return [];
    }

    const url = `${CIMA_ENDPOINT}?nombre=${encodeURIComponent(consulta)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const respuesta = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!respuesta.ok) {
        return [];
      }

      const data = (await respuesta.json()) as CimaBusquedaRespuesta;
      const resultados = data.resultados ?? [];
      const consultaNormalizada = normalizarTexto(consulta);

      const unicos = new Map<string, SugerenciaMedicamentoCima>();
      const porRelevancia: Array<[string, SugerenciaMedicamentoCima, number]> = [];

      for (const item of resultados) {
        const mapped = mapear(item);
        const clave = `${mapped.nombre}|${mapped.dosis}`;
        
        if (!unicos.has(clave)) {
          unicos.set(clave, mapped);
          const relevancia = calcularRelevancia(mapped, consultaNormalizada);
          if (relevancia > 0) {
            porRelevancia.push([clave, mapped, relevancia]);
          }
        }
      }

      // Ordenar por relevancia descendente y limit a 15
      return porRelevancia
        .sort((a, b) => b[2] - a[2])
        .slice(0, 15)
        .map(([, item]) => item);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  },
};