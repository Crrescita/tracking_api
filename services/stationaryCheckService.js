const admin = require("../firebase");
const { getAddressFromLatLng } = require("../utils/mapboxReverseGeocode");
const sqlModel = require("../config/db");

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
exports.checkStationaryEmployees = async () => {
  try {
    console.log("⏱ Running stationary check...");

    /* -------- get employees who tracked in last hour -------- */
    const employees = await sqlModel.customQuery(`
      SELECT DISTINCT emp_id, company_id
      FROM emp_tracking
      WHERE created_at >= NOW() - INTERVAL 1 HOUR
    `);

    //  const employees = await sqlModel.customQuery(`
    //   SELECT DISTINCT emp_id, company_id
    //   FROM emp_tracking
    //   WHERE emp_id = 36
    // `);
console.log(`Found ${employees.length} employees with tracking data in the last hour.`);
    for (const emp of employees) {
      const { emp_id, company_id } = emp;

      const history = await sqlModel.customQuery(
        `
        SELECT latitude, longitude, datetime_mobile
        FROM emp_tracking
        WHERE emp_id = ?
          AND company_id = ?
          AND datetime_mobile >= NOW() - INTERVAL 1 HOUR
        ORDER BY datetime_mobile ASC
      `,
        [emp_id, company_id]
      );
console.log(`Employee ${emp_id} has ${history.length} tracking points in the last hour.`);
      if (!history || history.length < 5) continue;

      const baseLat = parseFloat(history[0].latitude);
      const baseLng = parseFloat(history[0].longitude);

      const ALLOWED_RADIUS = 30;

      const isStationary = history.every((p) => {
        return (
          getDistanceInMeters(
            baseLat,
            baseLng,
            parseFloat(p.latitude),
            parseFloat(p.longitude)
          ) <= ALLOWED_RADIUS
        );
      });

      const start = new Date(history[0].datetime_mobile.replace(" ", "T"));
      const end = new Date(
        history[history.length - 1].datetime_mobile.replace(" ", "T")
      );

      const duration = (end - start) / (1000 * 60);
console.log(`Employee ${emp_id} stationary: ${isStationary}, duration: ${duration.toFixed(2)} minutes`);
    //   if (!isStationary || duration < 60) continue;
if (duration < 1) continue;  // only 1 minute for test

      /* -------- check existing visit -------- */
      const [existingVisit] = await sqlModel.customQuery(
        `
        SELECT id FROM visits
        WHERE emp_id = ?
          AND company_id = ?
          AND status = 'pending'
        LIMIT 1
      `,
        [emp_id, company_id]
      );

      if (existingVisit) continue;

      /* -------- insert visit -------- */
      const address = await getAddressFromLatLng(baseLat, baseLng);

      const visitResult = await sqlModel.insert("visits", {
        emp_id,
        company_id,
        latitude: baseLat,
        longitude: baseLng,
        address,
        status: "pending",
        created_at: getCurrentDateTime(),
      });

      const visitId = visitResult.insertId;
console.log(`Created visit ${visitId} for employee ${emp_id} at address: ${address} `, visitResult);
      /* -------- send FCM -------- */
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
            body:
              "You have been at the same location for over 1 hour. Please create a visit.",
          },
          data: {
                type: "VISIT_PENDING",
                visit_id: visitId.toString(),
                latitude: baseLat.toString(),
                longitude: baseLng.toString(),
                address:address.toString(),
              },
        });
      }
    }
  } catch (err) {
    console.error("Stationary cron error:", err);
  }
};
