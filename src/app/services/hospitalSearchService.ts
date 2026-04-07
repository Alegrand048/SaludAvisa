/**
 * Servicio de búsqueda de ubicaciones médicas usando OpenStreetMap Nominatim
 * Libre, sin API key requerida
 */

interface NominatimResult {
  lat: string;
  lon: string;
  name: string;
  address?: string;
  type?: string;
}

const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
const FALLBACK_LOCATIONS = [
  "Hospital Infanta Elena, Huelva",
  "Hospital Juan Ramón Jiménez, Huelva",
  "Hospital Clínico Universitario",
  "Hospital General Universitario",
  "Hospital Virgen del Rocío, Sevilla",
];

export const hospitalSearchService = {
  /**
   * Busca hospitales y clínicas usando Nominatim
   * Fallback a lista local si la API falla
   */
  async searchHospitals(query: string): Promise<string[]> {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    try {
      // Construir búsqueda específica para centros médicos en España
      const searchQuery = `${query} hospital clinica centro medico Spain`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${NOMINATIM_API}?${new URLSearchParams({
          q: searchQuery,
          format: "json",
          limit: "10",
          countrycodes: "es",
        })}`,
        {
          headers: {
            "Accept-Language": "es",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        return this.getFallbackResults(query);
      }

      const results = (await response.json()) as NominatimResult[];

      if (!results || results.length === 0) {
        return this.getFallbackResults(query);
      }

      // Filtrar y formatear resultados
      const locations = results
        .filter(r => this.isHealthcareFacility(r))
        .slice(0, 8)
        .map(r => this.formatResult(r));

      // Si no hay resultados filtrados, devolver fallback
      if (locations.length === 0) {
        return this.getFallbackResults(query);
      }

      return locations;
    } catch (error) {
      console.warn("Error al buscar hospitales en Nominatim, usando fallback:", error);
      return this.getFallbackResults(query);
    }
  },

  /**
   * Verifica si un resultado es un centro de salud
   */
  isHealthcareFacility(result: NominatimResult): boolean {
    const keywords = ["hospital", "clinica", "clínica", "centro medico", "medical", "health", "sanatorio"];
    const text = `${result.name} ${result.address || ""}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword));
  },

  /**
   * Formatea el resultado de Nominatim
   */
  formatResult(result: NominatimResult): string {
    return result.name || `${result.lat}, ${result.lon}`;
  },

  /**
   * Obtiene resultados del fallback local basado en la consulta
   */
  getFallbackResults(query: string): string[] {
    if (!query.trim()) {
      return [];
    }

    const normalized = query.toLowerCase().trim();
    
    // Búsqueda en fallback
    const scored = FALLBACK_LOCATIONS.map(location => {
      const locNormalized = location.toLowerCase();
      let score = 0;

      if (locNormalized.startsWith(normalized)) {
        score = 1000;
      } else if (locNormalized.includes(normalized)) {
        score = 500;
      }

      // Búsqueda por palabras
      const words = normalized.split(/\s+/);
      for (const word of words) {
        if (locNormalized.includes(word)) {
          score += 100;
        }
      }

      return { location, score };
    }).filter(item => item.score > 0);

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.location);
  },

  /**
   * Obtiene sugerencias iniciales
   */
  getInitialSuggestions(): string[] {
    return FALLBACK_LOCATIONS;
  },
};
