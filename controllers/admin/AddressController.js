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
    const insert = req.body;
    console.log(insert);

    if (!Array.isArray(insert) || insert.length === 0) {
      return res
        .status(400)
        .send({ status: false, message: "No coordinates provided." });
    }

    // Remove duplicates based on longitude, latitude, and address
    const uniqueCoordinates = Array.from(
      new Set(
        insert.map(
          (coord) => `${coord.longitude},${coord.latitude},${coord.address}`
        )
      )
    ).map((e) => {
      const [longitude, latitude, address] = e.split(",");
      return {
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude),
        address,
      };
    });

    // Check for existing entries and prepare data for insertion or update
    const existingEntries = await sqlModel.select("coordinates_address", [
      "longitude",
      "latitude",
      "address",
    ]);

    const existingSet = new Set(
      existingEntries.map(
        (entry) => `${entry.longitude},${entry.latitude},${entry.address}`
      )
    );

    const insertOrUpdatePromises = uniqueCoordinates.map(async (coordinate) => {
      const key = `${coordinate.longitude},${coordinate.latitude},${coordinate.address}`;

      if (!existingSet.has(key)) {
        const insertData = {
          longitude: coordinate.longitude,
          latitude: coordinate.latitude,
          address: coordinate.address,
          created_at: getCurrentDateTime(),
          updated_at: getCurrentDateTime(),
        };
        await sqlModel.insert("coordinates_address", insertData);
      } else {
        // Optionally, you can update existing records if needed
        console.log(`Skipping duplicate entry: ${key}`);
      }
    });

    await Promise.all(insertOrUpdatePromises);

    res
      .status(200)
      .send({ status: true, message: "Coordinates processed successfully." });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
