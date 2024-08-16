const sqlModel = require("../../config/db");
const deleteOldFile = require("../../middleware/deleteImage");

exports.WelcomePageData = async (req, res, next) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).send({
        status: false,
        message: "Title and description are required fields",
      });
    }

    const existingEntry = await sqlModel.select("welcome_page", [
      "id",
      "image",
    ]);

    let imagePath = "";

    if (req.files && req.files.image) {
      imagePath = req.fileFullPath.find((path) => path.includes("image"));
    }

    if (existingEntry.length > 0) {
      const [entry] = existingEntry;

      const updateData = {
        title,
        description,
      };

      // Handle image update
      if (imagePath) {
        if (entry.image) {
          // Delete the old image file
          deleteOldFile.deleteOldFile(entry.image);
        }
        updateData.image = imagePath;
      }

      await sqlModel.update("welcome_page", updateData, { id: entry.id });

      res.status(200).send({
        status: true,
        message: "Welcome page updated successfully",
      });
    } else {
      const insertData = {
        title,
        description,
        image: imagePath || "",
      };

      await sqlModel.insert("welcome_page", insertData);

      res.status(201).send({
        status: true,
        message: "Welcome page created successfully",
      });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.getWelcomePage = async (req, res, next) => {
  try {
    // Fetch the single entry from the welcome_page table
    const [welcomePage] = await sqlModel.select("welcome_page", [
      "title",
      "description",
      "image",
    ]);

    if (!welcomePage) {
      return res.status(404).send({
        status: false,
        message: "Welcome page not found",
      });
    }

    // Prepend the base URL to the image path if the image exists
    if (welcomePage.image) {
      welcomePage.image = `${process.env.BASE_URL}${welcomePage.image}`;
    }

    res.status(200).send({
      status: true,
      data: welcomePage,
    });
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
