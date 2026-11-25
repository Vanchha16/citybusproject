// A tiny GTFS feed (file name -> CSV text) with the awkward parts real feeds have:
// a way back on different streets, frequency-based trips, a weekend-only service,
// Khmer translations and a road shape. Used by gtfs.test.js.
import { gtfsMinutes } from '../../src/gtfs.js';

export const FEED = {
  'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nPPCBA,Test City Bus,https://example.org,Asia/Phnom_Penh\n',
  'feed_info.txt': 'feed_publisher_name,feed_publisher_url,feed_lang,feed_version\nTest City Bus,https://example.org,en,2026-11\n',
  'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20261231\nWE,0,0,0,0,0,1,1,20260101,20261231\n',
  'stops.txt': [
    'stop_id,stop_name,stop_lat,stop_lon',
    'A,Central Market,11.5697,104.9211',
    'B,"Monivong, Sihanouk",11.556,104.919',
    'C,AEON Mean Chey,11.5163,104.932',
    'E,Chbar Ampov,11.53,104.94',
    'D,Stung Meanchey,11.50,104.90',
    'AIR,Techo Airport,11.3629,104.9166',
    'UNUSED,Nobody stops here,11.6,104.9',
  ].join('\n'),
  'routes.txt': 'route_id,route_short_name,route_long_name,route_type,route_color\nR1,10,Central – Airport,3,FFC629\nR2,20,,3,\n',
  'trips.txt': [
    'route_id,service_id,trip_id,direction_id,shape_id',
    'R1,WK,T1a,0,S1', 'R1,WK,T1b,0,S1', 'R1,WK,T1c,0,S1', 'R1,WK,T1r,1,',
    'R2,WK,T20,0,', 'R2,WK,T20r,1,', 'R2,WE,T2W,0,',
  ].join('\n'),
  'stop_times.txt': [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
    ...['06:00', '06:15', '06:30'].flatMap((start, k) => {
      const t0 = gtfsMinutes(start);
      const at = (m) => { const x = t0 + m; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}:00`; };
      const id = ['T1a', 'T1b', 'T1c'][k];
      return [`${id},${at(0)},${at(0)},A,1`, `${id},${at(5)},${at(5)},B,2`, `${id},${at(15)},${at(15)},C,3`, `${id},${at(45)},${at(45)},AIR,4`];
    }),
    'T1r,07:00:00,07:00:00,AIR,1', 'T1r,07:30:00,07:30:00,C,2', 'T1r,07:36:00,07:36:00,E,3', 'T1r,07:45:00,07:45:00,A,4',
    'T20,06:00:00,06:00:00,B,1', 'T20,06:10:00,06:10:00,C,2', 'T20,06:20:00,06:20:00,D,3',
    'T20r,06:00:00,06:00:00,D,1', 'T20r,06:10:00,06:10:00,C,2', 'T20r,06:20:00,06:20:00,B,3',
    'T2W,09:00:00,09:00:00,B,1', 'T2W,09:20:00,09:20:00,D,2',
  ].join('\n'),
  'frequencies.txt': 'trip_id,start_time,end_time,headway_secs\nT20,06:00:00,08:00:00,600\n',
  'shapes.txt': [
    'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
    ...[[11.5697, 104.9211], [11.563, 104.92], [11.556, 104.919], [11.536, 104.925], [11.5163, 104.932], [11.44, 104.923], [11.3629, 104.9166]]
      .map(([lat, lng], i) => `S1,${lat},${lng},${i + 1}`),
  ].join('\n'),
  'translations.txt': [
    'table_name,field_name,language,translation,record_id,field_value',
    'stops,stop_name,km,ផ្សារធំថ្មី,A,',
    'routes,route_long_name,km,ផ្សារធំថ្មី – អាកាសយានដ្ឋាន,,Central – Airport',
  ].join('\n'),
};
