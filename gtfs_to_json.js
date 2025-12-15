const fs = require('fs');

function parseCSV(file) {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').split('\n');
  const keys = head.trim().split(',');
  return rows
    .filter(r => r.trim())
    .map(r => {
      const values = r.split(',');
      return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    });
}

const stops = parseCSV('stops.txt');
const stopTimes = parseCSV('stop_times.txt');
const trips = parseCSV('trips.txt');
const routes = parseCSV('routes.txt');

const routesById = Object.fromEntries(
  routes.map(r => [r.route_id, r.route_short_name])
);

const tripsById = Object.fromEntries(
  trips.map(t => [t.trip_id, {
    line: routesById[t.route_id],
    dest: t.trip_headsign
  }])
);

const result = {};

stopTimes.forEach(st => {
  const stop = stops.find(s => s.stop_id === st.stop_id);
  const trip = tripsById[st.trip_id];
  if (!stop || !trip) return;

  if (!result[stop.stop_name]) {
    result[stop.stop_name] = {
      lat: stop.stop_lat,
      lon: stop.stop_lon,
      departures: []
    };
  }

  result[stop.stop_name].departures.push({
    line: trip.line,
    dest: trip.dest,
    time: st.departure_time
  });
});

fs.writeFileSync('pmdp.json', JSON.stringify(result));
console.log('✔ pmdp.json vytvořen');
