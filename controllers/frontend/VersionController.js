const sqlModel = require("../../config/db");

exports.manageVersionInsert = async (req, res, next) => {
  try {
    let { version, version_status, device } = req.body;

    device = device.toLowerCase();

    const versionData = {
      version,
      version_status,
      device,
    };

    const existingRecord = await sqlModel.select("app_update", ["id"], {
      version,
      device,
    });

    if (existingRecord && existingRecord.length > 0) {
      versionData.updated_at = getCurrentDateTime();

      const updateResult = await sqlModel.update("app_update", versionData, {
        version,
        device,
      });

      if (updateResult.error) {
        return res.status(200).send({
          status: false,
          message: "Error updating the record",
          error: updateResult.error,
        });
      } else {
        return res.status(200).send({
          status: true,
          message: "Record updated successfully",
        });
      }
    } else {
      versionData.created_at = getCurrentDateTime();

      const insertResult = await sqlModel.insert("app_update", versionData);

      if (insertResult.error) {
        return res.status(200).send({
          status: false,
          message: "Error saving the data",
          error: insertResult.error,
        });
      } else {
        return res.status(200).send({
          status: true,
          message: "Data saved successfully",
        });
      }
    }
  } catch (error) {
    return res.status(500).send({
      status: false,
      error: error.message,
    });
  }
};

exports.manageVersion = async (req, res, next) => {
  try {
    let { version, device } = req.body;

    device = device.toLowerCase();

    const [result] = await sqlModel.select(
      "app_update",
      ["version", "version_status", "update_link"],
      { device, version },
      "ORDER BY id DESC"
    );

    const [latestVersionResult] = await sqlModel.select(
      "app_update",
      ["version", "version_status", "update_link"],
      { device },
      "ORDER BY id DESC"
    );

    if (!result) {
      return res.status(200).send({
        status: false,
        is_update: false,
        is_logout: false,
        msg: "No update information found",
      });
    }

    const {
      version: latestVersion,
      version_status: latestVersionStatus,
      update_link: latestUpdateLink,
    } = latestVersionResult;

    const { version_status, update_link } = result;

    const isUpdateRequired = version_status == 0;

    return res.status(200).send({
      status: true,
      is_update: isUpdateRequired,
      is_logout: false,
      msg: isUpdateRequired
        ? `Please update your app to the latest version ${latestVersion}`
        : "Your app is up to date",
      link: isUpdateRequired ? latestUpdateLink : "",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      error: error.message,
    });
  }
};
