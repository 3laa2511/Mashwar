---
name: weather-api-web-api
description: Use this skill when a user needs to retrieve meteorological data for specific latitude and longitude coordinates using the Google Maps Platform Weather API. Invoke this skill to fetch current weather conditions, generate daily or hourly weather forecasts, retrieve up to 24 hours of historical hourly weather data, or check real-time severe weather alerts via HTTP REST endpoints.
license: Apache-2.0
metadata:
  version: 1.0.54
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Google Maps Platform Weather API is an HTTP REST web service that provides
comprehensive meteorological data for any given latitude and longitude
coordinates. Use this skill to integrate location-based weather intelligence
into applications, including current observations, short-term and multi-day
forecasts, recent historical conditions, and active real-time weather alerts.

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Environment (Optional - Use-Case Dependent)

-   [ ] **Retrieves the current real-time weather conditions for a specific
    geographic location using latitude and longitude coordinates.** Read
    [references/return-current-weather-conditions-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/weather-api-web-api/references/return-current-weather-conditions-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user needs current, real-time weather data
    (e.g., temperature, humidity, wind, precipitation) for a given latitude and
    longitude. *Evidence Checkpoint*: Verify that the HTTP GET request to the
    currentConditions endpoint returns a 200 OK status and a valid JSON payload
    containing current weather metrics.
-   [ ] **Retrieves a multi-day weather forecast for a specific geographic
    location using latitude and longitude coordinates.** Read
    [references/return-daily-weather-forecast-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/weather-api-web-api/references/return-daily-weather-forecast-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user asks for a daily weather forecast or
    multi-day weather outlook for a given latitude and longitude. *Evidence
    Checkpoint*: Verify that the HTTP GET request to the forecast/days endpoint
    returns a 200 OK status and a valid JSON payload containing daily forecast
    entries.
-   [ ] **Retrieves an hour-by-hour weather forecast for a specific geographic
    location using latitude and longitude coordinates.** Read
    [references/return-hourly-weather-forecast-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/weather-api-web-api/references/return-hourly-weather-forecast-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user asks for an hourly weather forecast
    or hour-by-hour weather predictions for a given latitude and longitude.
    *Evidence Checkpoint*: Verify that the HTTP GET request to the
    forecast/hours endpoint returns a 200 OK status and a valid JSON payload
    containing hourly forecast entries.
-   [ ] **Retrieves up to 24 hours of past hourly historical weather data for a
    specific geographic location using latitude and longitude coordinates.**
    Read
    [references/return-up-24-hours-hourly-historical-weather-data-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/weather-api-web-api/references/return-up-24-hours-hourly-historical-weather-data-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user needs historical weather conditions
    or past hourly weather data (up to the last 24 hours) for a given latitude
    and longitude. *Evidence Checkpoint*: Verify that the HTTP GET request to
    the history/hours endpoint returns a 200 OK status and a valid JSON payload
    containing historical hourly weather records.
-   [ ] **Retrieves active, real-time public weather alerts and warnings for a
    specific geographic location using latitude and longitude coordinates.**
    Read
    [references/return-weather-alerts-occurring-real-time-given-latitude-and-longitude.md](https://www.gstatic.com/googlemapsplatform-agent-skills/weather-api-web-api/references/return-weather-alerts-occurring-real-time-given-latitude-and-longitude.md).
    *Trigger Condition*: Use when the user wants to check for active weather
    alerts, severe weather warnings, or advisories for a given latitude and
    longitude. *Evidence Checkpoint*: Verify that the HTTP GET request to the
    publicAlerts endpoint returns a 200 OK status and a valid JSON payload
    listing active weather alerts (or an empty list if none are active).
