const sqlModel = require("../../config/db");
const path = require("path");
// const sendMail = require("../../middleware/mail");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const baseDir = path.join(__dirname, "uploads");
const saltRounds = 10;

exports.login = async (req, res, next) => {
  try {
    const { email, password, user_type } = req.body;

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

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(200).send({
        status: false,
        message: "Password do not match",
        statusCode: 3,
      });
    }

    // Generate a new token
    const token = crypto.randomBytes(20).toString("hex");

    // Update the user with the new token
    await sqlModel.update(table, { api_token: token }, { id: user.id });

    // Fetch the updated user
    const [updatedUser] = await sqlModel.select(table, {}, { email });

    // Respond with the updated user data
    return res.status(200).send({
      status: true,
      data: updatedUser,
      user_type: user_type,
      message: "Login successfully",
      statusCode: 3,
    });
  } catch (error) {
    // Respond with a generic error message
    return res.status(500).send({
      status: false,
      message: "An error occurred during login",
      error: error.message,
    });
  }
};

exports.forgetPass = async (req, res, next) => {
  try {
    let email = req.body.email;
    let type = req.body.type;

    // Check if user with email exists
    let [result] = await sqlModel.select("users", {}, { email: email });

    if (!result) {
      return res.status(200).send({ status: false, message: "User not found" });
    }

    // Generate reset token
    let token = crypto.randomBytes(20).toString("hex");
    resetToken = token;
    resetTokenExpires = Date.now() + 3600000; // Token expires in 1 hour

    var insert = {
      reset_token: resetToken,
      token_expire: resetTokenExpires,
    };

    result = await sqlModel.update("users", insert, { email: email });

    // Send reset email
    // let resetLink = "";
    // if (type == "user") {
    //   resetLink = `http://localhost:4200/preacher-question?token=${token}`;
    // } else if (type == "admin") {
    //   resetLink = `http://localhost:4200/auth/pass-change?token=${token}`;
    // } else {
    //   res.status(200).send({ status: true, message: "Role is not define" });
    // }

    let data = {
      // resetLink
      resetLink:
        type == "user"
          ? `https://rmd.crrescita.com/ask-questions?token=${token}`
          : `https://rmdadmin.crrescita.com/auth/pass-change?token=${token}`,
    };
    // let a = sendMail.forget(email, data);
    res.status(200).send({ status: true, message: "Mail Sent" });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.resetPass = async (req, res, next) => {
  try {
    var token = req.body.token;
    var new_password = req.body.new_password;

    // Find user by reset token
    var user = await sqlModel.select("users", {}, { reset_token: token });
    console.log(user[0]);
    if (!user[0] || user[0].resetTokenExpires < Date.now()) {
      console.log("working");

      return res.status(200).send("Invalid or expired reset token");
    }
    var insert = user[0];
    const idString_pre = String(new_password);
    console.log("3");

    // Create a Buffer from the string
    const buffer_pre = Buffer.from(idString_pre);

    // Convert the Buffer to Base64
    const pass = buffer_pre.toString("base64");
    insert.password = pass;
    insert.reset_token = "";
    insert.token_expire = "";

    result = await sqlModel.update("users", insert, { email: user[0].email });

    res
      .status(200)
      .send({ status: true, message: "Password reset successful" });
  } catch (error) {
    res.status(200).send({ status: false, error: error.message });
  }
};

exports.update_details = async (req, res, next) => {
  try {
    let token = req.body.api_token;
    const insert = {
      username: req.body.username,
      email: req.body.email,
      update_at: getCurrentDateTime(),
    };

    result = await sqlModel.update("users", insert, { api_token: token });

    resMsg = {
      status: true,
      message: "Record update successfully",
      statusCode: 3,
    };
    return res.status(200).send(resMsg);
  } catch (error) {
    return res.status(200).json({
      status: false,
      statuscode: 2,
      message: "Something went wrong!" + error,
    });
  }
};

exports.update_password = async (req, res, next) => {
  try {
    let token = req.body.api_token;

    let old = req.body.old_password ? req.body.old_password : "";
    if (old) {
      old_pass = await sqlModel.select("users", {}, { api_token: token });

      console.log(old_pass);
      console.log(old_pass[0].password);
      const buffer = Buffer.from(old_pass[0].password, "base64");

      // Convert the Buffer to a string
      const str = buffer.toString("utf8");
      console.log(str);

      if (req.body.old_password != str) {
        resMsg = {
          message: "Old password is not correct",
        };
        return res.status(200).send(resMsg);
      } else {
        if (req.body.password != "") {
          const idString_pre = String(req.body.password);
          console.log("3");

          // Create a Buffer from the string
          const buffer_pre = Buffer.from(idString_pre);

          // Convert the Buffer to Base64
          const pass = buffer_pre.toString("base64");
          const newData = {
            password: pass,
          };
          await sqlModel.update("users", newData, { api_token: token });
        }
      }
    }

    resMsg = {
      status: true,
      message: "Record update successfully",
      statusCode: 3,
    };

    return res.status(200).send(resMsg);
  } catch (error) {
    return res.status(200).json({
      status: false,
      statuscode: 2,
      message: "Something went wrong!" + error,
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
