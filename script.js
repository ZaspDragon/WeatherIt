const state = {
  intervalId: null,
  lastCoords: null,
};

const els = {
  latInput: document.getElementById('latInput'),
  lonInput: document.getElementById('lonInput'),
  intervalSelect: document.getElementById('intervalSelect'),
  autoLocateBtn: document.getElementById('autoLocateBtn'),
  demoBtn: document.getElementById('demoBtn'),
  loadBtn: document.getElementById('loadBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  heroTemp: document.getElementById('heroTemp'),
  heroSummary: document.getElementById('heroSummary'),
  forecastTemp: document.getElementById('forecastTemp'),
  observedTemp: document.getElementById('observedTemp'),
  deltaTemp: document.getElementById('deltaTemp'),
  signalBadge: document.getElementById('signalBadge'),
  signalReason: document.getElementById('signalReason'),
  signalDelta: document.getElementById('signalDelta'),
  signalConfidence: document.getElementById('signalConfidence'),
  hourlyList: document.getElementById('hourlyList'),
  locationLabel: document.getElementById('locationLabel'),
  officeLabel: document.getElementById('officeLabel'),
  rainChance: document.getElementById('rainChance'),
  windValue: document.getElementById('windValue'),
  humidityValue: document.getElementById('humidityValue'),
  stationName: document.getElementById('stationName'),
  lastUpdated: document.getElementById('lastUpdated'),
};

const APP_UA = 'weather-trading-dashboard-demo (demo@example.com)';

function nwsFetch(url) {
  return fetch(url, {
    headers: {
      'Accept': 'application/geo+json',
      'User-Agent': APP_UA,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NWS request failed (${res.status}): ${text.slice(0, 140)}`);
    }
    return res.json();
  });
}

function formatHour(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDelta(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;
}

function qvToFahrenheit(qv) {
  if (!qv || qv.value == null) return null;
  const unit = qv.unitCode || '';
  if (unit.endsWith(':degC')) return (qv.value * 9) / 5 + 32;
  if (unit.endsWith(':degF')) return qv.value;
  return null;
}

function updateSignal(delta, obsTime) {
  let badge = 'Neutral';
  let klass = 'neutral';
  let confidence = 'Low';
  let reason = 'Forecast and latest observation are close enough that there is no strong directional edge yet.';

  if (delta == null || Number.isNaN(delta)) {
    reason = 'Observation data is unavailable, so the dashboard can only show the forecast side.';
  } else if (delta >= 3) {
    badge = 'Hot bias';
    klass = 'hot';
    confidence = 'Medium';
    reason = `Latest observed temperature is running ${delta.toFixed(1)}° above the current hourly forecast, which can hint the day is tracking warmer than expected.`;
  } else if (delta <= -3) {
    badge = 'Cool bias';
    klass = 'cool';
    confidence = 'Medium';
    reason = `Latest observed temperature is running ${Math.abs(delta).toFixed(1)}° below the current hourly forecast, which can hint the day is tracking cooler than expected.`;
  } else if (Math.abs(delta) >= 1.5) {
    badge = 'Watch';
    klass = 'watch';
    confidence = 'Low-Med';
    reason = `The latest observed temperature differs from forecast by ${Math.abs(delta).toFixed(1)}°. Not huge, but enough to keep an eye on.`;
  }

  if (obsTime) {
    const observedAt = new Date(obsTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    reason += ` Observation timestamp: ${observedAt}.`;
  }

  els.signalBadge.textContent = badge;
  els.signalBadge.className = `signal ${klass}`;
  els.signalReason.textContent = reason;
  els.signalDelta.textContent = delta == null || Number.isNaN(delta) ? '--' : formatDelta(delta);
  els.signalConfidence.textContent = confidence;
}

function renderHourly(periods) {
  if (!periods?.length) {
    els.hourlyList.className = 'hourly-list empty-state';
    els.hourlyList.textContent = 'No forecast periods returned.';
    return;
  }

  els.hourlyList.className = 'hourly-list';
  els.hourlyList.innerHTML = periods.slice(0, 12).map((period) => `
    <article class="hour-row">
      <time>${formatHour(period.startTime)}</time>
      <div>
        <div>${period.shortForecast || '—'}</div>
        <div class="hour-summary">Rain ${period.probabilityOfPrecipitation?.value ?? 0}% · Wind ${period.windSpeed || '—'} ${period.windDirection || ''}</div>
      </div>
      <div class="hour-temp">${period.temperature}°${period.temperatureUnit}</div>
    </article>
  `).join('');
}

async function fetchLatestObservation(stationsUrl) {
  const stationsData = await nwsFetch(stationsUrl);
  const firstStation = stationsData.features?.[0]?.properties;
  if (!firstStation?.stationIdentifier || !firstStation?.@id) {
    return null;
  }

  const latestUrl = `${firstStation['@id']}/observations/latest`;
  const latestData = await nwsFetch(latestUrl);

  return {
    stationName: firstStation.name || firstStation.stationIdentifier,
    stationId: firstStation.stationIdentifier,
    timestamp: latestData.properties?.timestamp,
    observedTempF: qvToFahrenheit(latestData.properties?.temperature),
  };
}

async function loadDashboard(lat, lon) {
  try {
    els.heroSummary.textContent = 'Loading forecast and observations…';
    const points = await nwsFetch(`https://api.weather.gov/points/${lat},${lon}`);
    const props = points.properties;
    const hourly = await nwsFetch(props.forecastHourly);
    const periods = hourly.properties?.periods || [];
    const current = periods[0];
    const observation = await fetchLatestObservation(props.observationStations);

    const observed = observation?.observedTempF ?? null;
    const forecast = current?.temperature ?? null;
    const delta = observed != null && forecast != null ? observed - forecast : null;

    els.heroTemp.textContent = forecast != null ? `${forecast}°${current.temperatureUnit}` : '--°';
    els.heroSummary.textContent = current ? current.shortForecast : 'No forecast returned.';
    els.forecastTemp.textContent = forecast != null ? `${forecast}°${current.temperatureUnit}` : '--°';
    els.observedTemp.textContent = observed != null ? `${observed.toFixed(1)}°F` : '--';
    els.deltaTemp.textContent = formatDelta(delta);
    els.locationLabel.textContent = props.relativeLocation?.properties?.city
      ? `${props.relativeLocation.properties.city}, ${props.relativeLocation.properties.state}`
      : `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
    els.officeLabel.textContent = `Office: ${props.cwa || '--'}`;
    els.rainChance.textContent = `${current?.probabilityOfPrecipitation?.value ?? 0}%`;
    els.windValue.textContent = current ? `${current.windSpeed} ${current.windDirection}` : '--';
    els.humidityValue.textContent = current?.relativeHumidity?.value != null ? `${Math.round(current.relativeHumidity.value)}%` : '--';
    els.stationName.textContent = observation?.stationName || 'Unavailable';
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    renderHourly(periods);
    updateSignal(delta, observation?.timestamp);

    state.lastCoords = { lat, lon };
  } catch (err) {
    console.error(err);
    els.heroTemp.textContent = '--°';
    els.heroSummary.textContent = 'Could not load data. If you are testing locally and run into CORS issues, use a small local server or GitHub Pages.';
    els.hourlyList.className = 'hourly-list empty-state';
    els.hourlyList.textContent = err.message;
    updateSignal(null);
  }
}

function startRefreshTimer() {
  clearInterval(state.intervalId);
  const minutes = Number(els.intervalSelect.value);
  if (!minutes || !state.lastCoords) return;

  state.intervalId = setInterval(() => {
    loadDashboard(state.lastCoords.lat, state.lastCoords.lon);
  }, minutes * 60 * 1000);
}

function useCurrentInputs() {
  const lat = Number(els.latInput.value);
  const lon = Number(els.lonInput.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    els.heroSummary.textContent = 'Enter valid latitude and longitude.';
    return;
  }
  loadDashboard(lat, lon).then(startRefreshTimer);
}

els.loadBtn.addEventListener('click', useCurrentInputs);
els.refreshBtn.addEventListener('click', () => {
  if (state.lastCoords) {
    loadDashboard(state.lastCoords.lat, state.lastCoords.lon);
  } else {
    useCurrentInputs();
  }
});
els.intervalSelect.addEventListener('change', startRefreshTimer);
els.demoBtn.addEventListener('click', () => {
  els.latInput.value = '39.9612';
  els.lonInput.value = '-82.9988';
  useCurrentInputs();
});
els.autoLocateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    els.heroSummary.textContent = 'Geolocation is not supported on this device.';
    return;
  }

  els.heroSummary.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      els.latInput.value = latitude.toFixed(6);
      els.lonInput.value = longitude.toFixed(6);
      loadDashboard(latitude, longitude).then(startRefreshTimer);
    },
    (error) => {
      els.heroSummary.textContent = `Location failed: ${error.message}`;
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
  );
});

// Demo load to make the page feel alive on first open.
els.latInput.value = '39.9612';
els.lonInput.value = '-82.9988';
loadDashboard(39.9612, -82.9988).then(startRefreshTimer);
