const admin = require("../firebase");
const { getAddressFromLatLng } = require("../utils/mapboxReverseGeocode");
const sqlModel = require("../config/db");
const { getCurrentDateTime } = require("../config/datetime");

const THRESHOLD_MINUTES = parseInt(process.env.STATIONARY_THRESHOLD || 60);
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
    console.log("⏱ Running optimized stationary check...");

    /* -------- STEP 1: Fetch ALL relevant tracking -------- */
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
      console.log("No tracking data found");
      return;
    }

    /* -------- STEP 2: Group by employee -------- */
    const grouped = groupByEmployee(trackingRows);

    /* -------- STEP 3: Fetch all active visits in one go -------- */
    const activeVisits = await sqlModel.customQuery(`
      SELECT *
      FROM visits
      WHERE status = 'active'
    `);

    const activeVisitMap = new Map();
    activeVisits.forEach(v => {
      activeVisitMap.set(`${v.emp_id}_${v.company_id}`, v);
    });

    /* -------- STEP 4: Process each employee -------- */
    for (const [key, history] of grouped.entries()) {
      try {
        const [emp_id, company_id] = key.split("_");

        if (history.length < 5) continue;

        /* -------- GAP CHECK -------- */
        let hasLargeGap = false;
        for (let i = 1; i < history.length; i++) {
          const prev = new Date(history[i - 1].datetime_mobile);
          const curr = new Date(history[i].datetime_mobile);

          const gap = (curr - prev) / (1000 * 60);
          if (gap > MAX_GAP_MINUTES) {
            hasLargeGap = true;
            break;
          }
        }
        if (hasLargeGap) continue;

        /* -------- CENTROID -------- */
        let sumLat = 0, sumLng = 0;
        history.forEach(p => {
          sumLat += parseFloat(p.latitude);
          sumLng += parseFloat(p.longitude);
        });

        const centerLat = sumLat / history.length;
        const centerLng = sumLng / history.length;

        /* -------- STATIONARY CHECK -------- */
        const isStationary = history.every(p => {
          return getDistanceInMeters(
            centerLat,
            centerLng,
            parseFloat(p.latitude),
            parseFloat(p.longitude)
          ) <= ALLOWED_RADIUS;
        });

        if (!isStationary) continue;

        /* -------- DURATION -------- */
        const start = new Date(history[0].datetime_mobile);
        const end = new Date(history[history.length - 1].datetime_mobile);
        const duration = (end - start) / (1000 * 60);

        if (duration < THRESHOLD_MINUTES) continue;

        /* -------- EXISTING VISIT -------- */
        const activeVisit = activeVisitMap.get(key);

        let isSameLocation = false;

        if (activeVisit) {
          const dist = getDistanceInMeters(
            centerLat,
            centerLng,
            parseFloat(activeVisit.latitude),
            parseFloat(activeVisit.longitude)
          );

          isSameLocation = dist <= ALLOWED_RADIUS;
        }

        /* ===================================================== */
        /* =============== DECISION ENGINE ====================== */
        /* ===================================================== */

        /* -------- CASE 1: NO ACTIVE VISIT -------- */
        if (!activeVisit) {
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

          console.log(`✅ New visit created for emp ${emp_id}`);

          /* -------- Notification -------- */
          const [empRow] = await sqlModel.select(
            "employees",
            ["fcm_token"],
            { id: emp_id }
          );

          if (empRow?.fcm_token) {
            await admin.messaging().send({
              token: empRow.fcm_token,
              notification: {
                title: "Visit Required",
                body: "You have been at same location for long duration.",
              },
              data: {
                type: "VISIT_CREATED",
                "screen": "visit_log_list",
                "source": "visit_reminder",
                "title": "Visit log reminder",
                "body": "You've been at this location for over" + duration + " minutes.",
                "visitId": visitResult.insertId.toString(),
              },
            });
          }

          continue;
        }

        /* -------- CASE 2: SAME LOCATION → UPDATE -------- */
        if (isSameLocation) {
          await sqlModel.update(
            "visits",
            {
              to_time: end,
              duration_minutes: Math.floor(duration),
            },
            { id: activeVisit.id }
          );

          console.log(`🔄 Updated visit for emp ${emp_id}`);
          continue;
        }

        /* -------- CASE 3: LOCATION CHANGED -------- */
        await sqlModel.update(
          "visits",
          {
            status: "pending",
            to_time: end,
          },
          { id: activeVisit.id }
        );

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

        console.log(`📍 Location changed → new visit for emp ${emp_id}`);

      } catch (empErr) {
        console.error(`❌ Employee failed ${key}`, empErr.message);
      }
    }

  } catch (err) {
    console.error("❌ Stationary cron error:", err);
  }
};