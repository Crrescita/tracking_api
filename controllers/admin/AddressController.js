const sqlModel = require("../../config/db");

exports.createAddress = async (req, res, next) => {
  try {
    const insert = { ...req.body };
    const coordinateEntries = Object.values(insert);

    if (!Array.isArray(coordinateEntries) || coordinateEntries.length === 0) {
      return res
        .status(400)
        .send({ status: false, message: "No coordinates provided." });
    }

    const insertOrUpdatePromises = coordinateEntries.map(async (coordinate) => {
      const { longitude, latitude, address } = coordinate;

      const [existingEntry] = await sqlModel.select(
        "coordinates_address",
        ["id"],
        { longitude, latitude }
      );

      const insertData = {
        longitude,
        latitude,
        address,
        updated_at: getCurrentDateTime(),
      };

      if (existingEntry) {
        await sqlModel.update("coordinates_address", insertData, {
          id: existingEntry.id,
        });
      } else {
        insertData.created_at = getCurrentDateTime();
        await sqlModel.insert("coordinates_address", insertData);
      }
    });

    // Wait for all promises to resolve
    await Promise.all(insertOrUpdatePromises);

    res
      .status(200)
      .send({ status: true, message: "Coordinates processed successfully." });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
