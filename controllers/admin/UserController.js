const sqlModel = require("../../config/db");
const path = require("path");
// const sendMail = require("../../middleware/mail");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const baseDir = path.join(__dirname, "uploads");
const saltRounds = 10;
const sendMail = require("../../mail/nodemailer");

// exports.login = async (req, res, next) => {
//   try {
//     const { email, password, user_type } = req.body;

//     const table = user_type === "administrator" ? "users" : "company";

//     const [user] = await sqlModel.select(table, {}, { email });

//     if (!user) {
//       return res.status(200).send({
//         status: false,
//         message: "Email does not exist",
//         statusCode: 4,
//       });
//     }

//     if (user_type === "company" && user.status !== "active") {
//       return res.status(200).send({
//         status: false,
//         message: "Company account is inactive",
//         statusCode: 5,
//       });
//     }

//     // Verify password
//     const passwordMatch = await bcrypt.compare(password, user.password);
//     if (!passwordMatch) {
//       return res.status(200).send({
//         status: false,
//         message: "Password do not match",
//         statusCode: 3,
//       });
//     }

//     // Generate a new token
//     const token = crypto.randomBytes(20).toString("hex");

//     // Update the user with the new token
//     await sqlModel.update(table, { api_token: token }, { id: user.id });

//     // Fetch the updated user
//     const [updatedUser] = await sqlModel.select(table, {}, { email });

//     // Respond with the updated user data
//     return res.status(200).send({
//       status: true,
//       data: updatedUser,
//       user_type: user_type,
//       message: "Login successfully",
//       statusCode: 3,
//     });
//   } catch (error) {
//     // Respond with a generic error message
//     return res.status(500).send({
//       status: false,
//       message: "An error occurred during login",
//       error: error.message,
//     });
//   }
// };

exports.login = async (req, res, next) => {
  try {
    const { email, password, user_type, device_info } = req.body;

    const table = user_type === "administrator" ? "users" : "company";

    const [user] = await sqlModel.select(table, {}, { email });

    if (!user) {
      return res.status(200).send({
        status: false,
        message: "Email does not exist",
        statusCode: 4,
      });
    }

    if (user_type === "company" && user.status !== "active") {
      return res.status(200).send({
        status: false,
        message: "Company account is inactive",
        statusCode: 5,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(200).send({
        status: false,
        message: "Password do not match",
        statusCode: 3,
      });
    }

    const token = crypto.randomBytes(20).toString("hex");

    await sqlModel.insert("user_sessions", {
      user_id: user.id,
      api_token: token,
      user_type: user_type,
      device_info: device_info || "unknown",
      ip_address:
        req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    });

    await sqlModel.update(table, { api_token: token }, { id: user.id });

    const [updatedUser] = await sqlModel.select(table, {}, { email });

    return res.status(200).send({
      status: true,
      data: updatedUser,
      token: token,
      user_type: user_type,
      message: "Login successfully",
      statusCode: 3,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "An error occurred during login",
      error: error.message,
    });
  }
};

exports.forgetPass = async (req, res, next) => {
  try {
    const { email, user_type } = req.body;

    const table = user_type === "administrator" ? "users" : "company";

    const [user] = await sqlModel.select(table, {}, { email });

    if (!user) {
      return res.status(200).send({
        status: false,
        message: "Email does not exist",
        statusCode: 4,
      });
    }

    if (user_type == "company" && user.status != "active") {
      return res.status(200).send({
        status: false,
        message: "Company account is inactive",
        statusCode: 5,
      });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpires = Date.now() + 3600000; // 1 hour validity

    await sqlModel.update(
      table,
      {
        reset_token: resetToken,
        token_expire: resetTokenExpires,
      },
      { id: user.id }
    );

    const resetLink =
      user_type === "administrator"
        ? `${process.env.BASE_URL}/auth/pass-change?userType=administrator&token=${resetToken}`
        : `${process.env.BASE_URL}/auth/pass-change?userType=company&token=${resetToken}`;

    const data = {
      email,
      resetLink,
      name: user_type === "administrator" ? user.username : user.name,
    };

    await sendMail.forgotPassword(data);

    // Send a response indicating that the mail was sent
    return res.status(200).send({
      status: true,
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "An error occurred while processing the password reset",
      error: error.message,
    });
  }
};

exports.resetPass = async (req, res, next) => {
  try {
    const { token, new_password, user_type } = req.body;

    const table = user_type === "administrator" ? "users" : "company";

    const [user] = await sqlModel.select(table, {}, { reset_token: token });

    if (!user || user.token_expire < Date.now()) {
      return res.status(200).send({
        status: false,
        message: "Invalid or expired reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const updateData = {
      password: hashedPassword,
      reset_token: "",
      token_expire: "",
    };

    await sqlModel.update(table, updateData, { email: user.email });

    res.status(200).send({
      status: true,
      message: "Password reset successful",
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: "An error occurred during password reset",
      error: error.message,
    });
  }
};

exports.updateDetails = async (req, res, next) => {
  try {
    const { username, email, user_type } = req.body;

    const table = user_type === "administrator" ? "users" : "company";
    const updateData = {
      email,
    };
    if (user_type == "administrator") {
      updateData.username;
      updateData.update_at = getCurrentDateTime();
    } else {
      updateData.name = username;
      updateData.updated_at = getCurrentDateTime();
    }

    const result = await sqlModel.update(table, updateData, { email });

    // Check if any records were updated
    if (result.affectedRows === 0) {
      return res.status(200).send({
        status: false,
        message: "No record found with the provided token",
        statusCode: 2,
      });
    }

    // Success response
    res.status(200).send({
      status: true,
      message: "Record updated successfully",
      statusCode: 3,
    });
  } catch (error) {
    // Error response
    res.status(500).json({
      status: false,
      statusCode: 2,
      message: "Something went wrong! " + error.message,
    });
  }
};

exports.update_password = async (req, res, next) => {
  try {
    const { api_token, old_password, new_password, user_type } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).send({
        status: false,
        message: "Old and new passwords are required",
      });
    }

    const table = user_type === "administrator" ? "users" : "company";
    const [user] = await sqlModel.select(table, {}, { api_token: api_token });

    if (!user) {
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(old_password, user.password);
    if (!passwordMatch) {
      return res.status(400).send({
        status: false,
        message: "Old password is incorrect",
      });
    }

    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    await sqlModel.update(
      table,
      { password: hashedNewPassword },
      { api_token: api_token }
    );

    res.status(200).send({
      status: true,
      message: "Password updated successfully",
      statusCode: 3,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      statusCode: 2,
      message: "Something went wrong! " + error.message,
    });
  }
};

// exports.signup = async (req, res, next) => {
//   try {
//     const insert = {
//       username: req.body.username,
//       email: req.body.email,
//       city: req.body.city,
//       zipcode: req.body.zipcode,
//       type: "user",
//       update_at: getCurrentDateTime(),
//     };

//     const checkData = await sqlModel.select(
//       "users",
//       {},
//       { email: req.body.email }
//     );

//     if (checkData.length > 0) {
//       msg = "User Already Exist";
//       res.status(200).send({ status: true, message: msg });
//     } else {
//       const idString_pre = String(req.body.password);

//       // Create a Buffer from the string
//       const buffer_pre = Buffer.from(idString_pre);

//       // Convert the Buffer to Base64
//       const pass = buffer_pre.toString("base64");
//       insert.password = pass;
//       saveData = await sqlModel.insert("users", insert);
//       msg = "Record added";
//     }

//     resMsg = {
//       status: true,
//       message: "Record added",
//       statusCode: 3,
//     };
//     return res.status(200).send(resMsg);
//   } catch (error) {
//     return res.status(200).json({
//       status: false,
//       statuscode: 2,
//       message: "Something went wrong!" + error,
//     });
//   }
// };

exports.signup = async (req, res, next) => {
  try {
    const { username, email, city, zipcode, password } = req.body;

    const insert = {
      username,
      email,
      city,
      zipcode,
      type: "user",
      update_at: getCurrentDateTime(),
    };

    const checkData = await sqlModel.select("users", {}, { email });

    if (checkData.length > 0) {
      return res
        .status(200)
        .send({ status: false, message: "User Already Exist" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    insert.password = hashedPassword;

    const saveData = await sqlModel.insert("users", insert);

    if (saveData.error) {
      throw new Error(saveData.error);
    }

    return res.status(200).send({
      status: true,
      message: "Record added",
      statusCode: 3,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      statuscode: 2,
      message: "Something went wrong! " + error.message,
    });
  }
};

exports.get_users = async (req, res, next) => {
  try {
    const getData = await sqlModel.select("users", {}, {});
    if (getData.error) {
      return res.status(200).send(getData);
    } else {
      res.status(200).send({ status: true, data: getData });
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.getWebhook = async (req, res, next) => {
  try {
    // const queryParams = req.query;
    // res.json({
    //   message: "Query Parameters",
    //   data: queryParams,
    // });

    let mode = req.query["hub.mode"];
    let challange = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];
    const mytoken = "qwerty";
    if (mode && token) {
      if (mode === "subscribe" && token === mytoken) {
        console.log(challange);
        res.status(200).send(challange);
      } else {
        res.status(403);
      }
    } else {
      res.status(403);
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};

exports.postWebhook = async (req, res, next) => {
  try {
    let body_param = req.body;
    console.log(JSON.stringify(body_param, null, 2));
    if (body_param.object) {
      if (
        body_param.entry &&
        body_param.entry[0].changes &&
        body_param.entry[0].changes[0].value.messages &&
        body_param.entry[0].changes[0].value.messages[0]
      ) {
        let phon_no_id = "108184898862859";
        body_param.entry[0].challange[0].value.metadata.phone_number_id;
        let from = body_param.entry[0].changes[0].value.messages[0].from;
        let msg_body =
          body_param.entry[0].changes[0].value.messages[0].text.body;

        axios({
          method: "POST",
          url:
            "https://graph.facebook.com/v13.0/" +
            phon_no_id +
            "/messages?access_token=EAAYd8x4ZCKdABOyf6y1qj3wJiZAfC30R8lYZCP00sdZB8xOkwBvbdpy2esGZB5AF7amMWmHb6ZCZBTSi2UldH42TxYqSHvmjJcFeZB7weamZAzPeMgZAS7wo1pkDD7vZByZAKU20I90N0cL0PSM0cyZCWJmOigCs9LTJHuGCi8hZBFL29X5ZAYIZAwAnKNtrF7qQNZAZAL2blxWXXinso78ZAZBq6zzMGyPw0KSmlnUZD",
          data: {
            messaging_product: "whatsapp",
            to: from,
            text: {
              body: "Hi.. I'm Prasath",
            },
          },
          headers: {
            "Content-Type": "application/json",
          },
        })
          .then((response) => {
            console.log("Message sent:", response.data);
          })
          .catch((error) => {
            console.error("Error sending message:", error);
          });

        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    }
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};
