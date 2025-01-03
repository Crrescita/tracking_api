const sqlModel = require("../../config/db");

const getCurrentDate = () => {
  const currentDate = new Date();

  const options = {
    timeZone: "Asia/Kolkata",
  };
  const year = currentDate.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
};

exports.getCheckIn = async (req, res, next) => {
  try {
    const { emp_id, company_id, date } = req.query;

    if (!emp_id || !company_id || !date) {
      return res.status(400).send({
        status: false,
        message: "Employee ID, company ID, and date are required",
      });
    }

    const baseUrl =
      process.env.BASE_URL || "https://trackingapi.crrescita.com/";

    // Correct query to get all employees and their attendance data for the given date
    const query = `
      SELECT
        e.id,
        e.name,
        e.mobile,
        e.email,
        d.name AS department,
        de.name AS designation,
        e.employee_id,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        a.checkin_status,
        a.time_difference,
        a.total_duration,
        a.total_distance,
        c.date,
        c.check_in_time,
        c.check_out_time,
        c.duration
      FROM employees e
      LEFT JOIN department d ON e.department = d.id
      LEFT JOIN designation de ON e.designation = de.id
      LEFT JOIN emp_attendance a ON e.id = a.emp_id AND a.date = ?
      LEFT JOIN check_in c ON e.id = c.emp_id AND c.date = ?
      WHERE e.id = ? AND e.company_id = ?
    `;

    const values = [baseUrl, date, date, emp_id, company_id];
    const data = await sqlModel.customQuery(query, values);

    // Process the data
    const processedData = data.reduce((acc, item) => {
      const existingEmployee = acc.find((emp) => emp.id === item.id);

      // Set attendance status based on checkin_status or absence of attendance data
      let attendance_status = "Absent";
      if (item.checkin_status === "Leave") {
        attendance_status = "Leave";
      } else if (item.check_in_time || item.checkin_status) {
        attendance_status = "Present";
      }

      if (existingEmployee) {
        if (item.check_in_time) {
          existingEmployee.checkIns.push({
            check_in_time: item.check_in_time,
            check_out_time: item.check_out_time || null,
            duration: item.duration || 0,
          });
        }

        existingEmployee.latestCheckInTime =
          existingEmployee.latestCheckInTime || item.check_in_time;

        if (item.check_out_time) {
          existingEmployee.latestCheckOutTime = item.check_out_time;
        } else if (existingEmployee.checkIns.length > 0) {
          existingEmployee.latestCheckOutTime = null;
        }

        existingEmployee.checkin_status = item.checkin_status || "Absent";
        existingEmployee.timeDifference = item.time_difference || "-";
        existingEmployee.attendance_status = attendance_status;
      } else {
        acc.push({
          id: item.id,
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          designation: item.designation,
          department: item.department,
          employee_id: item.employee_id,
          image: item.image,
          date: item.date,
          checkIns: item.check_in_time
            ? [
                {
                  check_in_time: item.check_in_time,
                  check_out_time: item.check_out_time || null,
                  duration: item.duration || 0,
                },
              ]
            : [],
          latestCheckInTime: item.check_in_time || null,
          latestCheckOutTime: item.check_out_time || null,
          totalDuration: item.total_duration || "0h 0m 0s",
          totalDistance: item.total_distance || 0,
          checkin_status: item.checkin_status || "Absent",
          attendance_status: attendance_status,
          timeDifference: item.time_difference || "-",
        });
      }
      return acc;
    }, []);

    const totalDistance = processedData.reduce(
      (sum, emp) => sum + (emp.totalDistance || 0),
      0
    );

    if (processedData.length === 0) {
      return res.status(200).send({
        status: false,
        message: "No data found",
      });
    }

    res.status(200).send({
      status: true,
      data: processedData,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getCheckInAllDate = async (req, res, next) => {
  try {
    const { emp_id, company_id } = req.query;

    // Validate input parameters
    if (!emp_id || !company_id) {
      return res.status(400).send({
        status: false,
        message: "Employee ID and Company ID are required",
      });
    }

    // Define the base URL for image concatenation
    const baseUrl = process.env.BASE_URL || "";

    // Query to fetch employee details and their check-in data
    const mainQuery = `
      SELECT 
        e.id,
        e.name,
        e.mobile,
        e.email,
        e.designation,
        e.employee_id,
        CASE
          WHEN e.image IS NOT NULL THEN CONCAT(?, e.image)
          ELSE e.image
        END AS image,
        c.date,
        c.check_in_time,
        c.check_out_time
      FROM employees e
      LEFT JOIN check_in c ON e.id = c.emp_id AND e.company_id = c.company_id
      WHERE e.id = ? AND e.company_id = ?
      ORDER BY c.date, c.check_in_time
    `;

    const mainValues = [baseUrl, emp_id, company_id];
    const mainData = await sqlModel.customQuery(mainQuery, mainValues);

    // Handle query errors
    if (mainData.error) {
      return res.status(500).send(mainData);
    }

    // Handle case when no data is found
    if (mainData.length === 0) {
      return res.status(200).send({ status: false, message: "No data found" });
    }

    // Query to fetch all analytics data for the employee and company
    const analyticsQuery = `
      SELECT
        emp_id,
        company_id,
        date,
        checkin_status,
        time_difference,
        total_duration,
        total_distance
      FROM emp_attendance
      WHERE emp_id = ? AND company_id = ?
    `;

    const analyticsValues = [emp_id, company_id];
    const analyticsData = await sqlModel.customQuery(
      analyticsQuery,
      analyticsValues
    );

    // Handle analytics query errors
    if (analyticsData.error) {
      return res.status(500).send(analyticsData);
    }

    // Create a map of date to analytics data for quick lookup
    const analyticsMap = analyticsData.reduce((acc, item) => {
      acc[item.date] = {
        checkin_status: item.checkin_status,
        time_difference: item.time_difference,
        total_duration: item.total_duration,
        total_distance: item.total_distance,
      };
      return acc;
    }, {});

    // Group check-in data by date and calculate earliest and latest times
    const groupedData = mainData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {
          date: item.date,
          checkIns: [],
          earliestCheckInTime: item.check_in_time,
          latestCheckOutTime: item.check_out_time || null,
        };
      } else {
        acc[item.date].checkIns.push({
          check_in_time: item.check_in_time,
          check_out_time: item.check_out_time || null,
        });

        // Update earliestCheckInTime
        if (item.check_in_time < acc[item.date].earliestCheckInTime) {
          acc[item.date].earliestCheckInTime = item.check_in_time;
        }

        // Update latestCheckOutTime
        if (
          item.check_out_time &&
          (!acc[item.date].latestCheckOutTime ||
            item.check_out_time > acc[item.date].latestCheckOutTime)
        ) {
          acc[item.date].latestCheckOutTime = item.check_out_time;
        }
      }

      return acc;
    }, {});

    // Combine check-in data with analytics data
    const checkInDates = Object.values(groupedData).map((dateData) => {
      const analytics = analyticsMap[dateData.date] || {
        checkin_status: "-",
        time_difference: "0h 0m 0s",
        total_duration: "0h 0m 0s",
        total_distance: 0,
      };

      // Determine attendance_status
      const attendance_status =
        dateData.checkIns.length > 0 ? "Present" : "Absent";

      return {
        ...dateData,
        checkin_status: analytics.checkin_status,
        timeDifferencev2: analytics.time_difference,
        total_duration: analytics.total_duration,
        total_distance: analytics.total_distance,
        attendance_status,
      };
    });

    // Construct the final employee data object
    const employeeData = {
      id: mainData[0].id,
      name: mainData[0].name,
      mobile: mainData[0].mobile,
      email: mainData[0].email,
      designation: mainData[0].designation,
      employee_id: mainData[0].employee_id,
      image: mainData[0].image,
      checkInsByDate: checkInDates,
    };

    // Send the response
    res.status(200).send({
      status: true,
      data: employeeData,
    });
  } catch (error) {
    // Handle unexpected errors
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getCheckInOut = async (req, res, next) => {
  try {
    const companyId = req.query?.company_id || "";
    const date = getCurrentDate(); // Assuming this gets the current date in the correct format

    // SQL query to get the first check-in and last check-out along with relevant details
    const query = `
      WITH first_checkins AS (
  SELECT 
    emp_id,
    MIN(check_in_time) AS first_checkin_time,
    MIN(lat_check_in) AS lat_check_in,
    MIN(long_check_in) AS long_check_in,
    MIN(checkin_img) AS checkin_img,
    MIN(battery_status_at_checkIn) AS battery_status_at_checkIn
  FROM check_in
  WHERE company_id = ? AND date = ?
  GROUP BY emp_id
),
last_checkouts AS (
  SELECT 
    emp_id,
    MAX(check_out_time) AS last_checkout_time,
    MAX(lat_check_out) AS lat_check_out,
    MAX(long_check_out) AS long_check_out,
    MAX(checkout_img) AS checkout_img,
    MAX(checkin_status) AS lastCheckinStatus,
    MAX(battery_status_at_checkout) AS battery_status_at_checkout
  FROM check_in
  WHERE company_id = ? AND date = ?
  GROUP BY emp_id
),
latest_checkins AS (
  SELECT 
    emp_id,
    checkin_status,
    ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY id DESC) AS row_num
  FROM check_in
  WHERE company_id = ? AND date = ?
)
SELECT 
  u.id,
  u.name,
  u.image,
  ci.first_checkin_time,
  ci.lat_check_in,
  ci.long_check_in,
  ci.checkin_img,
  ci.battery_status_at_checkIn,
  co.last_checkout_time,
  co.lastCheckinStatus,
  co.lat_check_out,
  co.long_check_out,
  co.checkout_img,
  co.battery_status_at_checkout,
  lc.checkin_status AS latestCheckinStatus
FROM employees u
LEFT JOIN first_checkins ci ON u.id = ci.emp_id
LEFT JOIN last_checkouts co ON u.id = co.emp_id
LEFT JOIN (
  SELECT emp_id, checkin_status
  FROM latest_checkins
  WHERE row_num = 1
) lc ON u.id = lc.emp_id
WHERE u.company_id = ?;

    `;

    // Execute the query
    const data = await sqlModel.customQuery(query, [
      companyId,
      date,
      companyId,
      date,
      companyId,
      date,
      companyId,
    ]);

    // Separate the users into check-in and check-out arrays
    const checkInArray = [];
    const checkOutArray = [];

    data.forEach((result) => {
      if (result.first_checkin_time) {
        checkInArray.push({
          empId: result.id,
          name: result.name,
          image: result.image ? `${process.env.BASE_URL}${result.image}` : "",
          checkInTime: result.first_checkin_time,
          latCheckIn: result.lat_check_in,
          longCheckIn: result.long_check_in,
          checkinImg: result.checkin_img,
          batteryStatusAtCheckIn: result.battery_status_at_checkIn,
          latestCheckStatus: result.latestCheckinStatus,
        });
      }

      // Only add to checkOutArray if the lastCheckinStatus is not 'check-in'
      if (
        result.last_checkout_time &&
        result.latestCheckinStatus != "Check-in"
      ) {
        checkOutArray.push({
          empId: result.id,
          name: result.name,
          image: result.image ? `${process.env.BASE_URL}${result.image}` : "",
          checkOutTime: result.last_checkout_time,
          latCheckOut: result.lat_check_out,
          longCheckOut: result.long_check_out,
          checkoutImg: result.checkout_img,
          batteryStatusAtCheckOut: result.battery_status_at_checkout,
          latestCheckStatus: result.latestCheckinStatus,
        });
      }
    });

    // Send the response
    res.status(200).send({
      status: true,
      checkInArray,
      checkOutArray,
    });
  } catch (error) {
    // Send the response
    res.status(500).send({
      status: false,
      error: errorMessage,
    });
  }
};

exports.setCheckAddress = async (req, res, next) => {
  try {
    const { employeeId, checkInAddress, checkOutAddress, date } = req.body;

    if (!employeeId || !checkInAddress || !checkOutAddress || !date) {
      return res.status(400).json({
        status: false,
        message:
          "Missing required fields: employeeId, checkInAddress, checkOutAddress, or date.",
      });
    }

    // const emp_tracking = await sqlModel.customQuery(
    //   `
    //   SELECT max(datetime_mobile) as last_long_lat FROM emp_tracking where date = ? and emp_id = ? and gps_status = '1';
    //   `,
    //   [date, employeeId]
    // );

    // console.log(emp_tracking);

    // const emp_tracking = await sqlModel.select(
    //   "emp_tracking",
    //   {},
    //   { emp_id: employeeId }
    // );

    // const result = await sqlModel.customQuery(
    //   `
    //   UPDATE emp_attendance
    //   SET
    //     check_in_address = ?,
    //     check_out_address = ? ,
    //     last_lat_long_at = ?
    //   WHERE
    //     emp_id = ? AND date = ?
    //   `,
    //   [
    //     checkInAddress,
    //     checkOutAddress,
    //     emp_tracking.last_long_lat,
    //     employeeId,
    //     date,
    //   ]
    // );

    // Query to get the last longitude and latitude
    const query =
      `SELECT MAX(datetime_mobile) AS last_long_lat FROM emp_tracking WHERE date = '` +
      date +
      `' AND emp_id = ` +
      employeeId +
      ` AND gps_status = '1'`;
    const empTrackingData = await sqlModel.customQuery(query);

    // Log the retrieved data

    // Extract last_long_lat from the query result
    const lastLongLat =
      empTrackingData.length > 0 ? empTrackingData[0].last_long_lat : null;

    // Validate if last_long_lat is retrieved
    if (!lastLongLat) {
      console.error("No GPS data found for the given date and employee ID.");
      // return; // Exit early if no data is found
    }

    // // Fetch additional employee tracking data
    // const empTrackingDetails = await sqlModel.select(
    //   "emp_tracking",
    //   { emp_id: employeeId }
    // );

    // // Log additional details (if needed)
    // console.log(empTrackingDetails);

    // Perform the update query with the retrieved data
    const result = await sqlModel.customQuery(
      `
  UPDATE emp_attendance 
  SET 
    check_in_address = ?, 
    check_out_address = ?, 
    last_lat_long_at = ?
  WHERE 
    emp_id = ? AND date = ?
  `,
      [checkInAddress, checkOutAddress, lastLongLat, employeeId, date]
    );

    // Log the update result
    console.log("Update Result:", result);

    if (result.affectedRows > 0) {
      return res.status(200).json({
        status: true,
        message: "Check-in and check-out addresses updated successfully.",
      });
    } else {
      return res.status(404).json({
        status: false,
        message: "No record found to update.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the addresses.",
      error: error.message,
    });
  }
};
