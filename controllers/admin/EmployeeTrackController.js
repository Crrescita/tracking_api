const sqlModel = require("../../config/db");

const haversineDistance = (coords1, coords2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = parseFloat(coords1.latitude);
  const lon1 = parseFloat(coords1.longitude);
  const lat2 = parseFloat(coords2.latitude);
  const lon2 = parseFloat(coords2.longitude);

  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

// Haversine Distance function to calculate distance between two coordinates
const haversineDistances = (coord1, coord2) => {
  const R = 6371000; // Radius of Earth in meters
  const lat1 = coord1.latitude * (Math.PI / 180);
  const lat2 = coord2.latitude * (Math.PI / 180);
  const deltaLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const deltaLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
// main
exports.getCoordinates = async (req, res, next) => {
  try {
    let query =
      "SELECT id, row_id,emp_id,company_id,date,battery_status,gps_status,internet_status,motion,created_at,updated_at, time(datetime_mobile) as time, datetime_mobile, round(latitude,6) as latitude, round(longitude,6) as longitude FROM emp_tracking WHERE latitude != 0.0 AND longitude != 0.0 ";

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        query += ` AND ${key} = '${req.query[key]}'`;
      }
    }
    query += `group by latitude, longitude, time order by datetime_mobile asc`;
    const data = await sqlModel.customQuery(query);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    let totalDistance = 0;

    // Calculate the total distance between the coordinates
    for (let i = 0; i < data.length - 1; i++) {
      const distance = haversineDistance(data[i], data[i + 1]);
      totalDistance += distance;
    }

    // Send the response
    res.status(200).send({ status: true, totalDistance, data: data });
  } catch (error) {
    console.error("Error in getCoordinates:", error);
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getCoordinatesv2 = async (req, res, next) => {
  try {
    const whereClause = {};

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        whereClause[key] = req.query[key];
      }
    }

    const query = `
      SELECT t.latitude, t.longitude, t.date, t.time,t.battery_status, subquery.cnt, subquery.min_time, subquery.max_time
      FROM (
          SELECT ROUND(latitude, 3) AS latitude, ROUND(longitude, 3) AS longitude, date,
                 MIN(time) AS min_time, MAX(time) AS max_time, COUNT(*) AS cnt, MIN(id) AS min_id
          FROM emp_tracking
          WHERE emp_id = ? AND date = ? AND latitude != 0 AND longitude != 0
        
          GROUP BY ROUND(latitude, 3), ROUND(longitude, 3), date
      ) AS subquery
      JOIN emp_tracking AS t ON subquery.min_id = t.id
      ORDER BY subquery.min_time, subquery.max_time
    `;

    const emp_id = whereClause.emp_id || "";
    const date = whereClause.date || "";

    // Execute the custom query
    const data = await sqlModel.customQuery(query, [emp_id, date]);

    if (data.error) {
      return res.status(500).send(data);
    }

    if (data.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Calculate the time difference for each group and sort by time
    const result = data.map((item) => {
      const minTime = new Date(`${item.date} ${item.min_time}`);
      const maxTime = new Date(`${item.date} ${item.max_time}`);
      const timeDifference = maxTime - minTime; // Time difference in milliseconds

      // Convert milliseconds to hours, minutes, seconds
      const hours = Math.floor(timeDifference / 3600000);
      const minutes = Math.floor((timeDifference % 3600000) / 60000);
      const seconds = Math.floor((timeDifference % 60000) / 1000);

      item.time_difference = `${hours}h ${minutes}m ${seconds}s`;

      // Assuming `item.image` is included in the data
      item.image = item.image ? `${process.env.BASE_URL}${item.image}` : "";

      return item;
    });

    // Sort the result by min_time to ensure proper sequence
    result.sort(
      (a, b) =>
        new Date(`${a.date} ${a.min_time}`) -
        new Date(`${b.date} ${b.min_time}`)
    );

    res.status(200).send({ status: true, data: result });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
