const sqlModel = require("../../config/db");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");

const getCurrentDate = () => {
  return new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, device, ip_address, address } = req.body;

    const validation = validateFields({
      email,
      password,
      device,
      ip_address,
      address,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(404).send({
        status: false,
        message: "Email does not exist",
        statusCode: 4,
      });
    }

    const [employeeCompany] = await sqlModel.select(
      "company",
      {},
      { id: user.company_id }
    );

    if (employeeCompany.status !== "active") {
      return res.status(403).send({
        status: false,
        message: "Company account is inactive",
        statusCode: 5,
      });
    }

    if (user.status !== "active") {
      return res.status(403).send({
        status: false,
        message: "Employee account is inactive",
        statusCode: 5,
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send({
        status: false,
        message: "Password does not match",
        statusCode: 3,
      });
    }

    // Generate a new token
    const token = crypto.randomBytes(20).toString("hex");

    // Update the user with the new token
    await sqlModel.update("employees", { api_token: token }, { id: user.id });

    // Fetch the updated user
    const [updatedUser] = await sqlModel.select("employees", {}, { email });

    if (!updatedUser) {
      return res.status(500).send({
        status: false,
        message: "Failed to fetch updated user data",
        statusCode: 6,
      });
    }

    updatedUser.image = updatedUser.image
      ? `${process.env.BASE_URL}${updatedUser.image}`
      : "";
    delete updatedUser.password;

    const insert = {
      company_id: updatedUser.company_id,
      emp_id: updatedUser.id,
      device,
      ip_address,
      address,
      date: getCurrentDate(),
      created_at: getCurrentDateTime(),
    };

    const saveData = await sqlModel.insert("emp_login_history", insert);

    if (saveData.error) {
      throw new Error(saveData.error);
    }

    // Respond with the updated user data
    return res.status(200).send({
      status: true,
      data: updatedUser,
      message: "Login successful",
      statusCode: 0,
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: "Internal server error",
      error: error.message,
      statusCode: 2,
    });
  }
};

exports.forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const validation = validateFields({
      email,
    });
    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    // if (!email) {
    //   return res
    //     .status(400)
    //     .send({ status: false, message: "Email is required" });
    // }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(404).send({ status: false, message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpires = Date.now() + 3600000; // Token expires in 1 hour

    await sqlModel.update(
      "employees",
      { reset_token: resetToken, token_expire: resetTokenExpires },
      { email }
    );

    const resetLink = `${process.env.WEBSITE_BASE_URL}auth/pass-change?user=employee&token=${resetToken}`;
    const data = {
      email,
      resetLink,
      name: user.name,
    };

    await sendMail.forgotPassword(data);

    return res
      .status(200)
      .send({ status: true, message: "Password reset email sent" });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    const validation = validateFields({
      token,
      new_password,
    });

    if (!validation.valid) {
      return res.status(400).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    // Validate input
    //   if (!token || !new_password) {
    //     return res.status(400).send({
    //       status: false,
    //       message: "Token and new password are required",
    //     });
    //   }

    // Find user by reset token
    const [user] = await sqlModel.select(
      "employees",
      {},
      { reset_token: token }
    );

    if (!user) {
      return res.status(400).send({
        status: false,
        message: "Invalid or expired reset token",
      });
    }

    if (user.token_expire < Date.now()) {
      return res.status(400).send({
        status: false,
        message: "Reset token has expired",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update user's password and clear the reset token
    const updateData = {
      password: hashedPassword,
      reset_token: null,
      token_expire: null,
    };

    await sqlModel.update("employees", updateData, { email: user.email });

    return res.status(200).send({
      status: true,
      message: "Password reset successfull",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "An error occurred",
      error: error.message,
    });
  }
};
