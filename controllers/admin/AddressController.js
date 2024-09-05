exports.createAddress = async (req, res, next) => {
  try {
    const insert = { ...req.body };
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};
