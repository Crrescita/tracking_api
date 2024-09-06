const sqlModel = require("../../config/db");

// exports.createAddress = async (req, res, next) => {
//   try {
//     const insert = { ...req.body };
//     const coordinateEntries = Object.values(insert);

//     if (!Array.isArray(coordinateEntries) || coordinateEntries.length === 0) {
//       return res
//         .status(400)
//         .send({ status: false, message: "No coordinates provided." });
//     }

//     const insertOrUpdatePromises = coordinateEntries.map(async (coordinate) => {
//       const { longitude, latitude, address } = coordinate;

//       const [existingEntry] = await sqlModel.select(
//         "coordinates_address",
//         ["id"],
//         { longitude, latitude }
//       );

//       const insertData = {
//         longitude,
//         latitude,
//         address,
//         updated_at: getCurrentDateTime(),
//       };

//       if (existingEntry) {
//         await sqlModel.update("coordinates_address", insertData, {
//           id: existingEntry.id,
//         });
//       } else {
//         insertData.created_at = getCurrentDateTime();
//         await sqlModel.insert("coordinates_address", insertData);
//       }
//     });

//     // Wait for all promises to resolve
//     await Promise.all(insertOrUpdatePromises);

//     res
//       .status(200)
//       .send({ status: true, message: "Coordinates processed successfully." });
//   } catch (error) {
//     res.status(500).send({ status: false, error: error.message });
//   }
// };

exports.createAddress = async (req, res, next) => {
  try {
    const insert = { ...req.body };
    const coordinateEntries = Object.values(insert);

    if (!Array.isArray(coordinateEntries) || coordinateEntries.length === 0) {
      // return res
      //   .status(400)
      //   .send({ status: false, message: "No coordinates provided." });
    }

    let insertedCount = 0; // Track the number of inserted records

    const insertOrUpdatePromises = coordinateEntries.map(async (coordinate) => {
      const { longitude, latitude, address } = coordinate;

      // Round to 4 decimal places
      const roundedLongitude = parseFloat(longitude).toFixed(4);
      const roundedLatitude = parseFloat(latitude).toFixed(4);

      const [existingEntry] = await sqlModel.select(
        "coordinates_address",
        ["id"],
        {
          longitude: roundedLongitude,
          latitude: roundedLatitude,
        }
      );

      const insertData = {
        longitude: roundedLongitude,
        latitude: roundedLatitude,
        address,
      };

      if (!existingEntry) {
        // Only insert if no existing entry is found
        insertData.created_at = getCurrentDateTime();
        await sqlModel.insert("coordinates_address", insertData);
        insertedCount++;
      } else {
        (insertData.updated_at = getCurrentDateTime()),
          // Update the existing entry
          await sqlModel.update("coordinates_address", insertData, {
            id: existingEntry.id,
          });
      }
    });

    // Wait for all promises to resolve
    await Promise.all(insertOrUpdatePromises);

    res.status(200).send({
      status: true,
      message: "Coordinates processed successfully.",
      insertedCount,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
