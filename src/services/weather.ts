import type { DailyForecast, ResortWeatherData, SkiResort } from '../types';

/* =========================================================================
   REAL WEATHER ENGINE (OPEN-METEO)
   Free public weather API with no API key required.
   ========================================================================= */

export function getNeutralWeather(resort: SkiResort): ResortWeatherData {
  const elev = resort.summit_elev_ft || 8000;
  const baseTempF = Math.round(30 - (elev / 1000) * 1.5);
  return {
    snowfall_72h_in: 0,
    snowfall_7d_in: 0,
    snowfall_72h_cm: 0,
    snowfall_7d_cm: 0,
    current_temp_f: baseTempF,
    current_temp_c: Math.round(((baseTempF - 32) * 5) / 9),
    summit_wind_gust_mph: 15,
    freezing_level_ft: Math.max(0, elev - 2500),
    rain_to_base_risk: false,
    daily_forecast: [],
    is_live: false,
    last_updated: 'Checking Open-Meteo...',
  };
}

export async function fetchLiveWeather(resort: SkiResort): Promise<ResortWeatherData | null> {
  try {
    const summitElevFt = resort.summit_elev_ft || (resort.base_elev_ft ? resort.base_elev_ft + 2000 : 3000);
    const summitElevM = Math.round(summitElevFt * 0.3048);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${resort.lat}&longitude=${resort.lng}&elevation=${summitElevM}&hourly=snowfall,freezing_level_height,wind_gusts_10m,temperature_2m&daily=snowfall_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();

    const hourlySnow: number[] = data?.hourly?.snowfall || [];
    let snow72cm = 0;
    const hoursToSum = Math.min(72, hourlySnow.length);
    for (let i = 0; i < hoursToSum; i++) {
      snow72cm += hourlySnow[i] || 0;
    }
    const snow72in = Math.round((snow72cm / 2.54) * 10) / 10;

    const dailySnow: number[] = data?.daily?.snowfall_sum || [];
    const snow7dCm = dailySnow.reduce((a, b) => a + (b || 0), 0);
    const snow7dIn = Math.round((snow7dCm / 2.54) * 10) / 10;

    const daily_forecast: DailyForecast[] = (data?.daily?.time || []).map((t: string, idx: number) => {
      const cm = Math.round((data.daily.snowfall_sum?.[idx] || 0) * 10) / 10;
      const inches = Math.round((cm / 2.54) * 10) / 10;
      const tMaxC = Math.round(data.daily.temperature_2m_max?.[idx] || 0);
      const tMinC = Math.round(data.daily.temperature_2m_min?.[idx] || 0);
      return {
        date: t,
        snowfall_in: inches,
        snowfall_cm: cm,
        temp_max_f: Math.round((tMaxC * 9) / 5 + 32),
        temp_min_f: Math.round((tMinC * 9) / 5 + 32),
        temp_max_c: tMaxC,
        temp_min_c: tMinC,
      };
    });

    const curTempC = Math.round(data?.hourly?.temperature_2m?.[0] ?? -3);
    const curTempF = Math.round((curTempC * 9) / 5 + 32);

    return {
      snowfall_72h_in: snow72in,
      snowfall_7d_in: snow7dIn,
      snowfall_72h_cm: Math.round(snow72cm * 10) / 10,
      snowfall_7d_cm: Math.round(snow7dCm * 10) / 10,
      current_temp_f: curTempF,
      current_temp_c: curTempC,
      summit_wind_gust_mph: Math.round((data?.hourly?.wind_gusts_10m?.[0] || 15) * 0.621371),
      freezing_level_ft: Math.round((data?.hourly?.freezing_level_height?.[0] || 2500) * 3.28084),
      rain_to_base_risk: Boolean(data?.hourly?.temperature_2m?.[0] > 1.5 && (data?.hourly?.snowfall?.[0] || 0) > 0),
      daily_forecast,
      is_live: true,
      last_updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (e) {
    return null;
  }
}
