# Return Current Weather Conditions for Coordinates

## Overview

The `currentConditions:lookup` endpoint of the Google Maps Platform Weather API
returns comprehensive real-time weather conditions for a specific geographic
location defined by latitude and longitude coordinates. It also includes 24-hour
historical summary data (such as temperature changes, min/max temperatures, and
accumulated precipitation).

## Endpoint & Request Details

### HTTP Method & URL

```http
GET https://weather.googleapis.com/v1/currentConditions:lookup
```

### Required Headers

Include the usage attribution header in all standard REST API requests:

*   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1`

### Query Parameters

Parameter            | Type     | Required | Description
:------------------- | :------- | :------- | :----------
`key`                | `string` | Yes      | Your Google Maps Platform API key.
`location.latitude`  | `number` | Yes      | The latitude coordinate of the target location (e.g., `37.4220`).
`location.longitude` | `number` | Yes      | The longitude coordinate of the target location (e.g., `-122.0841`).
`unitsSystem`        | `string` | No       | The measurement system to use. Defaults to `METRIC` (Celsius, km/h, millimeters). Set to `IMPERIAL` for Fahrenheit, mph, and inches.

--------------------------------------------------------------------------------

## Code Examples

### 1. Request Current Conditions (Default / Metric Units)

#### cURL

```bash
curl -X GET \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://weather.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY&location.latitude=37.4220&location.longitude=-122.0841"
```

#### JavaScript (Fetch API)

```javascript
async function getCurrentWeather(lat, lng, apiKey) {
  const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('location.latitude', lat);
  url.searchParams.append('location.longitude', lng);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
```

### 2. Request Current Conditions (Imperial Units)

Specify `unitsSystem=IMPERIAL` to receive temperatures in Fahrenheit, wind
speeds in miles per hour, visibility in miles, and precipitation in inches.

#### cURL

```bash
curl -X GET \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://weather.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY&location.latitude=37.4220&location.longitude=-122.0841&unitsSystem=IMPERIAL"
```

#### JavaScript (Fetch API)

```javascript
async function getCurrentWeatherImperial(lat, lng, apiKey) {
  const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('location.latitude', lat);
  url.searchParams.append('location.longitude', lng);
  url.searchParams.append('unitsSystem', 'IMPERIAL');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
```

--------------------------------------------------------------------------------

## Response Structure

The API returns a JSON object containing current observations and a 24-hour
historical summary.

### Key Response Fields

*   `currentTime`: ISO 8601 timestamp of the observation.
*   `timeZone.id`: IANA time zone identifier (e.g., `"America/Los_Angeles"`).
*   `isDaytime`: Boolean indicating whether it is currently daytime at the
    location.
*   `weatherCondition`: Contains `type` (e.g., `"CLEAR"`), localized
    `description.text` (e.g., `"Sunny"`), and `iconBaseUri` for rendering
    weather icons.
*   `temperature`, `feelsLikeTemperature`, `dewPoint`, `heatIndex`, `windChill`:
    Objects containing `degrees` (number) and `unit` (`"CELSIUS"` or
    `"FAHRENHEIT"`).
*   `relativeHumidity`: Integer percentage (0–100).
*   `uvIndex`: Integer UV index value.
*   `precipitation`:
    *   `probability`: Contains `percent` (integer) and `type` (e.g., `"RAIN"`).
    *   `qpf`: Quantitative Precipitation Forecast containing `quantity` and
        `unit` (`"MILLIMETERS"` or `"INCHES"`).
*   `thunderstormProbability`: Integer percentage.
*   `airPressure.meanSeaLevelMillibars`: Atmospheric pressure in millibars.
*   `wind`:
    *   `direction`: Contains `degrees` (0–360) and `cardinal` (e.g.,
        `"NORTH_NORTHWEST"`).
    *   `speed` & `gust`: Objects containing `value` and `unit`
        (`"KILOMETERS_PER_HOUR"` or `"MILES_PER_HOUR"`).
*   `visibility`: Contains `distance` and `unit` (`"KILOMETERS"` or `"MILES"`).
*   `cloudCover`: Integer percentage of sky covered by clouds.
*   `currentConditionsHistory`: Past 24-hour data including `temperatureChange`,
    `maxTemperature`, `minTemperature`, and `qpf`.

### Sample Response (Metric)

```json
{
  "currentTime": "2025-01-28T22:04:12.025273178Z",
  "timeZone": {
    "id": "America/Los_Angeles"
  },
  "isDaytime": true,
  "weatherCondition": {
    "iconBaseUri": "https://maps.gstatic.com/weather/v1/sunny",
    "description": {
      "text": "Sunny",
      "languageCode": "en"
    },
    "type": "CLEAR"
  },
  "temperature": {
    "degrees": 13.7,
    "unit": "CELSIUS"
  },
  "feelsLikeTemperature": {
    "degrees": 13.1,
    "unit": "CELSIUS"
  },
  "dewPoint": {
    "degrees": 1.1,
    "unit": "CELSIUS"
  },
  "heatIndex": {
    "degrees": 13.7,
    "unit": "CELSIUS"
  },
  "windChill": {
    "degrees": 13.1,
    "unit": "CELSIUS"
  },
  "relativeHumidity": 42,
  "uvIndex": 1,
  "precipitation": {
    "probability": {
      "percent": 0,
      "type": "RAIN"
    },
    "qpf": {
      "quantity": 0,
      "unit": "MILLIMETERS"
    }
  },
  "thunderstormProbability": 0,
  "airPressure": {
    "meanSeaLevelMillibars": 1019.16
  },
  "wind": {
    "direction": {
      "degrees": 335,
      "cardinal": "NORTH_NORTHWEST"
    },
    "speed": {
      "value": 8,
      "unit": "KILOMETERS_PER_HOUR"
    },
    "gust": {
      "value": 18,
      "unit": "KILOMETERS_PER_HOUR"
    }
  },
  "visibility": {
    "distance": 16,
    "unit": "KILOMETERS"
  },
  "cloudCover": 0,
  "currentConditionsHistory": {
    "temperatureChange": {
      "degrees": -0.6,
      "unit": "CELSIUS"
    },
    "maxTemperature": {
      "degrees": 14.3,
      "unit": "CELSIUS"
    },
    "minTemperature": {
      "degrees": 3.7,
      "unit": "CELSIUS"
    },
    "qpf": {
      "quantity": 0,
      "unit": "MILLIMETERS"
    }
  }
}
```
