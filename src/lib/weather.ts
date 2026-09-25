// Live weather from Open-Meteo (free, no key). Cached for an hour per location.

export type Weather = {
  current: { temperature: number; humidity: number; precipitation: number; windSpeed: number; code: number };
  daily: { date: string; tMax: number; tMin: number; precipitation: number; precipitationProbability: number; code: number }[];
};

export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code` +
    `&timezone=Africa%2FPorto-Novo&forecast_days=7`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      current: {
        temperature: j.current.temperature_2m,
        humidity: j.current.relative_humidity_2m,
        precipitation: j.current.precipitation,
        windSpeed: j.current.wind_speed_10m,
        code: j.current.weather_code,
      },
      daily: j.daily.time.map((date: string, i: number) => ({
        date,
        tMax: j.daily.temperature_2m_max[i],
        tMin: j.daily.temperature_2m_min[i],
        precipitation: j.daily.precipitation_sum[i],
        precipitationProbability: j.daily.precipitation_probability_max[i],
        code: j.daily.weather_code[i],
      })),
    };
  } catch {
    return null;
  }
}

// WMO weather codes → short French label.
export function weatherLabel(code: number): string {
  if (code === 0) return "Ciel dégagé";
  if (code <= 2) return "Peu nuageux";
  if (code === 3) return "Couvert";
  if (code <= 48) return "Brouillard";
  if (code <= 57) return "Bruine";
  if (code <= 67) return "Pluie";
  if (code <= 82) return "Averses";
  return "Orages";
}

export function weatherSummary(w: Weather): string {
  const days = w.daily
    .slice(0, 5)
    .map((d) => `${d.date}: ${weatherLabel(d.code)}, ${d.tMin}–${d.tMax} °C, pluie ${d.precipitation} mm (${d.precipitationProbability} %)`)
    .join("; ");
  return `Actuellement ${w.current.temperature} °C, humidité ${w.current.humidity} %, ${weatherLabel(w.current.code)}. Prévisions: ${days}.`;
}
