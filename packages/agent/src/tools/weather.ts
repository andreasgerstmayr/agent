import { defineTool } from "../tools";

// WMO weather codes to human-readable descriptions
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// Well-known city coordinates for fast lookup
const CITY_COORDS: Record<string, { lat: number; lon: number; tz: string }> = {
  "vienna": { lat: 48.2082, lon: 16.3738, tz: "Europe/Vienna" },
  "london": { lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
  "new york": { lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  "tokyo": { lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  "paris": { lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
  "berlin": { lat: 52.52, lon: 13.405, tz: "Europe/Berlin" },
  "sydney": { lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
  "moscow": { lat: 55.7558, lon: 37.6173, tz: "Europe/Moscow" },
  "beijing": { lat: 39.9042, lon: 116.4074, tz: "Asia/Shanghai" },
  "mumbai": { lat: 19.076, lon: 72.8777, tz: "Asia/Kolkata" },
  "dubai": { lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" },
  "rome": { lat: 41.9028, lon: 12.4964, tz: "Europe/Rome" },
  "madrid": { lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" },
  "amsterdam": { lat: 52.3676, lon: 4.9041, tz: "Europe/Amsterdam" },
  "prague": { lat: 50.0755, lon: 14.4378, tz: "Europe/Prague" },
  "zurich": { lat: 47.3769, lon: 8.5417, tz: "Europe/Zurich" },
  "bangkok": { lat: 13.7563, lon: 100.5018, tz: "Asia/Bangkok" },
  "singapore": { lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore" },
  "los angeles": { lat: 34.0522, lon: -118.2437, tz: "America/Los_Angeles" },
  "chicago": { lat: 41.8781, lon: -87.6298, tz: "America/Chicago" },
  "toronto": { lat: 43.6532, lon: -79.3832, tz: "America/Toronto" },
  "san francisco": { lat: 37.7749, lon: -122.4194, tz: "America/Los_Angeles" },
  "seoul": { lat: 37.5665, lon: 126.978, tz: "Asia/Seoul" },
  "istanbul": { lat: 41.0082, lon: 28.9784, tz: "Europe/Istanbul" },
  "cairo": { lat: 30.0444, lon: 31.2357, tz: "Africa/Cairo" },
  "lisbon": { lat: 38.7223, lon: -9.1393, tz: "Europe/Lisbon" },
  "stockholm": { lat: 59.3293, lon: 18.0686, tz: "Europe/Stockholm" },
  "warsaw": { lat: 52.2297, lon: 21.0122, tz: "Europe/Warsaw" },
  "budapest": { lat: 47.4979, lon: 19.0402, tz: "Europe/Budapest" },
  "brno": { lat: 49.1951, lon: 16.6068, tz: "Europe/Prague" },
};

interface GeoResult {
  latitude: number;
  longitude: number;
  timezone?: string;
  name: string;
  country?: string;
}

interface WeatherCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  time: string;
}

async function geocode(
  city: string,
  country?: string,
): Promise<{ lat: number; lon: number; tz: string; name: string } | null> {
  const key = city.toLowerCase();
  if (!country && CITY_COORDS[key]) {
    const c = CITY_COORDS[key];
    return { lat: c.lat, lon: c.lon, tz: c.tz, name: city };
  }

  const q = encodeURIComponent(city);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: GeoResult[] };
  const results = data.results;
  if (!results || results.length === 0) return null;

  let match = results[0];
  if (country) {
    const countryLower = country.toLowerCase().replace(/-/g, " ");
    const found = results.find(
      (r) => r.country?.toLowerCase() === countryLower,
    );
    if (found) match = found;
  }

  return {
    lat: match.latitude,
    lon: match.longitude,
    tz: match.timezone || "UTC",
    name: match.name,
  };
}

export default defineTool({
  description:
    "Get the current weather/temperature for a given city. Returns temperature, conditions, and other weather details.",
  params: {
    city: {
      type: "string",
      description: "The city name, e.g. 'Vienna', 'New York', 'Tokyo'",
    },
    country: {
      type: "string",
      description:
        "Optional country name to disambiguate cities, e.g. 'austria', 'usa'. Uses lowercase, hyphenated format for multi-word countries.",
    },
  },
  required: ["city"],
  async execute({ city, country }) {
    const location = await geocode(city, country).catch(() => null);
    if (!location) {
      return JSON.stringify({
        error: `Could not find coordinates for '${city}'. Try a different spelling or specify a country.`,
      });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=${encodeURIComponent(location.tz)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return JSON.stringify({
        error: `Weather API returned status ${response.status}`,
      });
    }

    const data = (await response.json()) as { current?: WeatherCurrent };
    const current = data.current;
    if (!current) {
      return JSON.stringify({ error: "No current weather data available" });
    }

    const condition = WMO_CODES[current.weather_code] ?? `WMO code ${current.weather_code}`;

    return JSON.stringify({
      city: location.name,
      ...(country ? { country } : {}),
      temperature: `${current.temperature_2m} °C`,
      feelsLike: `${current.apparent_temperature} °C`,
      condition,
      wind: `${current.wind_speed_10m} km/h (${current.wind_direction_10m}°)`,
      humidity: `${current.relative_humidity_2m}%`,
      time: current.time,
      source: "open-meteo.com",
    });
  },
});
