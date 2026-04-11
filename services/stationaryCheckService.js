const admin = require("../firebase");
const { getAddressFromLatLng } = require("../utils/mapboxReverseGeocode");
const sqlModel = require("../config/db");
const { getCurrentDateTime } = require("../config/datetime");

const THRESHOLD_MINUTES = parseInt(process.env.STATIONARY_THRESHOLD || 1);
const ALLOWED_RADIUS = parseInt(process.env.LOCATION_RADIUS || 50);
const MAX_GAP_MINUTES = 20;

/* ---------------- Distance ---------------- */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------------- Helper: Group by emp ---------------- */
function groupByEmployee(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.emp_id}_${row.company_id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

/* ---------------- Main ---------------- */
exports.checkStationaryEmployees = async () => {
  try {
    console.log("⏱ Starting stationary check at:", new Date().toISOString());

    const trackingRows = await sqlModel.customQuery(`
      SELECT emp_id, company_id, latitude, longitude, datetime_mobile
      FROM emp_tracking
      WHERE datetime_mobile >= NOW() - INTERVAL 2 HOUR
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude != 0
        AND longitude != 0
      ORDER BY emp_id, datetime_mobile ASC
    `);

    if (!trackingRows.length) {
      console.log("ℹ️ No tracking data rows found in the last 2 hours.");
      return;
    }

    const grouped = groupByEmployee(trackingRows);
    console.log(`📊 Found tracking data for ${grouped.size} employees.`);

    const activeVisits = await sqlModel.customQuery(`
      SELECT * FROM visits WHERE status = 'active'
    `);

    const activeVisitMap = new Map();
    activeVisits.forEach(v => {
      activeVisitMap.set(`${v.emp_id}_${v.company_id}`, v);
    });

    for (const [key, history] of grouped.entries()) {
      const [emp_id, company_id] = key.split("_");
      
      try {
        if (history.length < 5) {
          console.log(`[SKIP] Emp ${emp_id}: Not enough points (${history.length}/5)`);
          continue;
        }

        /* -------- GAP CHECK -------- */
        let hasLargeGap = false;
        for (let i = 1; i < history.length; i++) {
          const prev = new Date(history[i - 1].datetime_mobile);
          const curr = new Date(history[i].datetime_mobile);
          const gap = (curr - prev) / (1000 * 60);
          if (gap > MAX_GAP_MINUTES) {
            hasLargeGap = true;
            console.log(`[SKIP] Emp ${emp_id}: Large gap found (${Math.round(gap)} mins)`);
            break;
          }
        }
        if (hasLargeGap) continue;

        /* -------- STATIONARY CHECK -------- */
        let sumLat = 0, sumLng = 0;
        history.forEach(p => {
          sumLat += parseFloat(p.latitude);
          sumLng += parseFloat(p.longitude);
        });

        const centerLat = sumLat / history.length;
        const centerLng = sumLng / history.length;

        const isStationary = history.every(p => {
          const d = getDistanceInMeters(centerLat, centerLng, parseFloat(p.latitude), parseFloat(p.longitude));
          return d <= ALLOWED_RADIUS;
        });

        if (!isStationary) {
          console.log(`[SKIP] Emp ${emp_id}: User is moving (outside ${ALLOWED_RADIUS}m radius)`);
          continue;
        }

        /* -------- DURATION -------- */
        const start = new Date(history[0].datetime_mobile);
        const end = new Date(history[history.length - 1].datetime_mobile);
        const duration = (end - start) / (1000 * 60);

        if (duration < THRESHOLD_MINUTES) {
          console.log(`[SKIP] Emp ${emp_id}: Duration (${Math.round(duration)} min) is less than threshold (${THRESHOLD_MINUTES} min)`);
          continue;
        }

        console.log(`[MATCH] Emp ${emp_id}: Stationary for ${Math.round(duration)} minutes. Checking visit status...`);

        const activeVisit = activeVisitMap.get(key);
        let isSameLocation = false;

        if (activeVisit) {
          const dist = getDistanceInMeters(centerLat, centerLng, parseFloat(activeVisit.latitude), parseFloat(activeVisit.longitude));
          isSameLocation = dist <= ALLOWED_RADIUS;
        }

        /* -------- CASE 1: NO ACTIVE VISIT -------- */
        if (!activeVisit) {
          console.log(`[PROCESS] Emp ${emp_id}: Creating NEW visit record...`);
          const address = await getAddressFromLatLng(centerLat, centerLng);

          const visitResult = await sqlModel.insert("visits", {
            emp_id,
            company_id,
            latitude: centerLat,
            longitude: centerLng,
            business_address: address,
            address,
            status: "active",
            from_time: start,
            to_time: end,
            duration_minutes: Math.floor(duration),
            created_at: getCurrentDateTime(),
          });

          console.log(`✅ New visit created for Emp ${emp_id} (Visit ID: ${visitResult.insertId})`);

          /* Notification */
          const [empRow] = await sqlModel.select("employees", ["fcm_token", "name"], { id: emp_id });
          
          if (empRow?.fcm_token) {
            console.log(`[NOTIF] Sending FCM notification to ${empRow.name}...`);
            const notifTitle = "Visit Log Reminder";
            const notifBody = `You've been at this location for over ${Math.floor(duration)} minutes. Please fill visit log.`;

            try {
              const res = await admin.messaging().send({
                token: empRow.fcm_token,
                notification: { title: notifTitle, body: notifBody },
                data: {
                  type: "VISIT_CREATED",
                  screen: "visit_log_list",
                  source: "visit_reminder",
                  title: notifTitle,
                  body: notifBody,
                  visitId: visitResult.insertId.toString(),
                },
                android: {
                  priority: "high",
                  notification: { channel_id: "high_importance_channel", sound: "default" },
                },
                apns: {
                  payload: { aps: { sound: "default", contentAvailable: true } },
                  headers: { "apns-priority": "10" },
                },
              });
              console.log(`✅ Notification sent successfully to Emp ${emp_id}. MessageID: ${res}`);
            } catch (notifErr) {
              console.error(`❌ Notification FAILED for Emp ${emp_id}:`, notifErr.message);
            }
          } else {
            console.log(`⚠️ No FCM token found for Emp ${emp_id}. Skipping notification.`);
          }
          continue;
        }

        /* -------- CASE 2: SAME LOCATION → UPDATE -------- */
        if (isSameLocation) {
          console.log(`[PROCESS] Emp ${emp_id}: Still at same location. Updating duration to ${Math.floor(duration)} mins.`);
          await sqlModel.update(
            "visits",
            {
              to_time: end,
              duration_minutes: Math.floor(duration),
            },
            { id: activeVisit.id }
          );
          continue;
        }

        /* -------- CASE 3: LOCATION CHANGED -------- */
        console.log(`[PROCESS] Emp ${emp_id}: Location changed. Closing old visit and opening new...`);
        await sqlModel.update("visits", { status: "pending", to_time: end }, { id: activeVisit.id });

        const address = await getAddressFromLatLng(centerLat, centerLng);
        const visitResult = await sqlModel.insert("visits", {
          emp_id,
          company_id,
          latitude: centerLat,
          longitude: centerLng,
          address,
          status: "active",
          from_time: start,
          to_time: end,
          duration_minutes: Math.floor(duration),
          created_at: getCurrentDateTime(),
        });
        console.log(`📍 New visit created for Emp ${emp_id} after location change.`);

      } catch (empErr) {
        console.error(`❌ Error processing Emp ${key}:`, empErr.message);
      }
    }

  } catch (err) {
    console.error("❌ Stationary cron CRITICAL error:", err);
  }
};