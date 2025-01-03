const sqlModel = require("../../config/db");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sendMail = require("../../mail/nodemailer");

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

exports.login = async (req, res, next) => {
  try {
    if (!req.body.model_no) {
      req.body.model_no = "old_version";
    }
    const { email, password, device, model_no, ip_address, address } = req.body;

    const validation = validateFields({
      email,
      password,
      device,
      ip_address,
      address,
    });

    if (!validation.valid) {
      return res.status(403).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(200).send({
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
      return res.status(200).send({
        status: false,
        message: "Company account is inactive",
        statusCode: 5,
      });
    }

    // if (user.status !== "active") {
    //   return res.status(200).send({
    //     status: false,
    //     message:
    //       "Your account is currently inactive. Please contact your administrator or support team to reactivate your account.",
    //     statusCode: 5,
    //   });
    // }

    if (user.status === "inactive") {
      return res.status(200).send({
        status: false,
        message:
          "Your account is suspended by the administrator. Please contact your administrator for further assistance.",
        statusCode: 5,
      });
    }

    if (user.status === "user_inactive") {
      // Reactivate the account
      await sqlModel.update(
        "employees",
        { status: "active", deactivate_at: null },
        { id: user.id }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(200).send({
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
      return res.status(200).send({
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
      model_no,
      type: 1,
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
    res.status(200).send({
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
    const validation = validateFields({ email });

    if (!validation.valid) {
      return res.status(200).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(200).send({ status: false, message: "User not found" });
    }

    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();
    const resetCodeExpires = Date.now() + 3600000; // Code expires in 1 hour

    await sqlModel.update(
      "employees",
      { reset_code: resetCode, code_expire: resetCodeExpires },
      { email }
    );

    const data = {
      email,
      resetCode,
      name: user.name,
    };

    await sendMail.forgotPasswordCode(data);

    return res.status(200).send({
      status: true,
      message: "Password reset code sent to your email",
    });
  } catch (error) {
    res.status(200).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.validateResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const validation = validateFields({ email, code });

    if (!validation.valid) {
      return res.status(200).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(200).send({ status: false, message: "User not found" });
    }

    if (user.reset_code !== code) {
      return res.status(200).send({
        status: false,
        message: "Invalid code",
      });
    }

    if (Date.now() > user.code_expire) {
      return res.status(200).send({
        status: false,
        message: "Code has expired",
      });
    }

    return res.status(200).send({
      status: true,
      message: "Code validated successfully. You may now reset your password.",
    });
  } catch (error) {
    res.status(200).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    const validation = validateFields({
      email,
      code,
      newPassword,
      confirmPassword,
    });

    if (!validation.valid) {
      return res.status(200).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(200).send({
        status: false,
        message: "Password and confirm password do not match",
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(200).send({ status: false, message: "User not found" });
    }

    if (user.reset_code !== code) {
      return res.status(200).send({
        status: false,
        message: "Invalid code",
      });
    }

    if (Date.now() > user.code_expire) {
      return res.status(200).send({
        status: false,
        message: "Code has expired",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await sqlModel.update(
      "employees",
      {
        password: hashedPassword,
        reset_code: null,
        code_expire: null,
        password_changed_status: "forgot_password",
      },
      { email }
    );

    const data = {
      email,
      newPassword,
      name: user.name,
    };

    await sendMail.passwordUpdated(data);

    return res.status(200).send({
      status: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(200).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { email, oldPassword, newPassword, confirmPassword } = req.body;
    const validation = validateFields({
      email,
      oldPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.valid) {
      return res.status(200).send({
        status: false,
        message: validation.message,
        statusCode: 1,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(200).send({
        status: false,
        message: "New password and confirm password do not match",
      });
    }

    const [user] = await sqlModel.select("employees", {}, { email });

    if (!user) {
      return res.status(200).send({ status: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(200).send({
        status: false,
        message: "Incorrect old password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await sqlModel.update(
      "employees",
      {
        password: hashedPassword,
        reset_code: null,
        code_expire: null,
        password_changed_status: "changed_old_password",
      },
      { email }
    );

    const data = {
      email,
      newPassword,
      name: user.name,
    };

    await sendMail.passwordUpdated(data);

    return res.status(200).send({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(200).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const { device, model_no, ip_address, address } = req.body;

    // Validate required fields
    const validation = validateFields({
      device,
      model_no,
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

    // Prepare data for logging device details
    const insertData = {
      company_id: employee.company_id,
      emp_id: employee.id, // Ensure to log this action against the employee ID
      device,
      model_no,
      type: 0,
      ip_address,
      address,
      date: getCurrentDate(),
      created_at: getCurrentDateTime(),
    };

    const saveData = await sqlModel.insert("emp_login_history", insertData);

    await sqlModel.update(
      "employees",
      { api_token: null },
      { id: employee.id }
    );

    res.status(200).send({
      status: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.toggleAccountStatus = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(200)
        .send({ status: false, message: "Token is required" });
    }

    const [employee] = await sqlModel.select(
      "employees",
      {},
      { api_token: token }
    );

    if (!employee) {
      return res
        .status(200)
        .send({ status: false, message: "Employee not found" });
    }

    const { status } = req.body;

    if (status !== "inactive" && status !== "active") {
      return res.status(200).send({
        status: false,
        message: "Invalid status value. Must be 'inactive' or 'active'.",
        statusCode: 1,
      });
    }

    const updateData = {
      status: status === "inactive" ? "user_inactive" : "active",
    };

    if (status === "inactive") {
      updateData.deactivate_at = getCurrentDateTime();
      updateData.api_token = null;
      updateData.fcm_token = null;
    }

    await sqlModel.update("employees", updateData, { id: employee.id });

    if (status == "inactive") {
      res.status(200).send({
        status: true,
        message:
          "Your account has been set to inactive. It will be permanently deleted after 90 days unless reactivated.",
        currentStatus: status,
      });
    } else if (status === "active") {
      res.status(200).send({
        status: true,
        message: "Your account has been reactivated successfully.",
        currentStatus: status,
      });
    }
  } catch (error) {
    res.status(500).send({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
