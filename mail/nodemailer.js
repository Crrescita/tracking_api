const nodemailer = require("nodemailer");
const fs = require("fs");
const ejs = require("ejs");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "palsudhanshu13@gmail.com",
    pass: "ulmh uaht rlss ojoi",
  },
});

async function sendEmailToEmp(data) {
  try {
    // Read and compile the EJS template with data
    const htmlFile = "./views/employee.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      //   from: '"Your Name" <your-email@gmail.com>',
      to: data.email,
      subject: "Welcome",
      //   text: "Hello world?",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function sendEmailToCompany(data) {
  try {
    // Read and compile the EJS template with data
    const htmlFile = "./views/company.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      //   from: '"Your Name" <your-email@gmail.com>',
      to: data.email,
      subject: "Welcome",
      //   text: "Hello world?",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function forgotPassword(data) {
  try {
    const htmlFile = "./views/forgotPassword.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      to: data.email,
      subject: "Password Reset Request",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function forgotPasswordCode(data) {
  try {
    const htmlFile = "./views/forgotPasswordCode.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      to: data.email,
      subject: "Password Reset Request",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function passwordUpdated(data) {
  try {
    const htmlFile = "./views/passwordUpdated.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      to: data.email,
      subject: "Password Updated",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

module.exports = {
  sendEmailToEmp,
  sendEmailToCompany,
  forgotPassword,
  forgotPasswordCode,
  passwordUpdated,
};
