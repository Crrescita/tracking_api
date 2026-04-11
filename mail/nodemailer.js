const nodemailer = require("nodemailer");
const fs = require("fs");
const ejs = require("ejs");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    // user: "palsudhanshu13@gmail.com",
    // pass: "ulmh uaht rlss ojoi",
    user: "contact@crrescita.com",
    pass: "zfhh oxft akyi huxy",
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
      subject: `Welcome to ${data.company} Attendance App – Start Your Daily Login Today!`,
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

async function sendLeaveRequestToCompany(data) {
  try {
    // Read and compile the EJS template with data
    const htmlFile = "./views/leaveRequest.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");
    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      //   from: '"Your Name" <your-email@gmail.com>',
      to: data.email,
      subject: "Leave Request Notification",
      //   text: "Hello world?",
      html: compiledHtml,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function sendSharedRequestToUser(data) {
  try {

    const htmlFile = "./views/shareRequest.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    let info = await transporter.sendMail({
      to: data.email,
      subject: `Request Update #${data.request_id}`,
      html: compiledHtml,
    });

    console.log("Message sent:", info.messageId);

  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function sendreqCreated(data) {
  try {
    const htmlFile = "./views/requestCreated.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `New ${data.type} Request #${data.request_id}`,
      html: compiledHtml,
    };

    // ✅ Multiple attachments support
    if (data.attachments && data.attachments.length > 0) {
      mailOptions.attachments = data.attachments.map((fileUrl) => ({
        filename: fileUrl.split("/").pop(),
        path: fileUrl,
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Request email sent:", info.messageId);
  } catch (error) {
    console.error(" Email error:", error.message);
  }
}

async function sendmailadminres(data) {
  try {
    const htmlFile = data.template || "./views/requestResponse.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: data.subject,
      html: compiledHtml,
    };

    // ✅ MULTIPLE attachments
    if (data.attachments && data.attachments.length > 0) {
      mailOptions.attachments = data.attachments.map((fileUrl) => ({
        filename: fileUrl.split("/").pop(),
        path: fileUrl,
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Response email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email error:", error.message);
  }
}

async function sendLeaveStatusUpdate(data) {
  try {
    const htmlFile = "./views/leaveStatusUpdate.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `Leave Request ${data.status}`,
      html: compiledHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Leave email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error.message);
  }
}

async function sendReimbursementCreated(data) {
  try {
    const htmlFile = "./views/reimbursementCreated.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `New Reimbursement Request #${data.reimbursement_id}`,
      html: compiledHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Reimbursement email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error.message);
  }
}

async function sendReimbursementStatusUpdate(data) {
  try {
    const htmlFile = "./views/reimbursementStatusUpdate.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject:
        data.status === "approved"
          ? "Reimbursement Approved"
          : "Reimbursement Rejected",
      html: compiledHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Reimbursement status email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error.message);
  }
}

async function sendTaskAssignedEmail(data) {
  try {
    const htmlFile = "./views/taskAssigned.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `New Task Assigned: ${data.task_title}`,
      html: compiledHtml,
    };

    // ✅ CC emails
    if (data.cc && data.cc.length > 0) {
      mailOptions.cc = data.cc;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(" Task email sent:", info.messageId);
  } catch (error) {
    console.error("❌Email error:", error.message);
  }
}

async function sendTaskStatusUpdate(data) {
  try {
    const htmlFile = "./views/taskStatusUpdate.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `Task Update: ${data.task_title}`,
      html: compiledHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(" Task status email sent:", info.messageId);
  } catch (error) {
    console.error(" Email error:", error.message);
  }
}

async function sendFollowupReminder(data) {
  try {
    const htmlFile = "./views/followupReminder.ejs";
    const htmlTemplate = fs.readFileSync(htmlFile, "utf8");

    const compiledHtml = ejs.render(htmlTemplate, data);

    const mailOptions = {
      from: `"CRRESCITA" <contact@crrescita.com>`,
      to: data.email,
      subject: `Follow-Up Reminder: ${data.type} Request #${data.request_id}`,
      html: compiledHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Followup reminder email sent:", info.messageId);
  } catch (error) {
    console.error("Followup reminder email error:", error.message);
  }
}

module.exports = {
  sendEmailToEmp,
  sendEmailToCompany,
  forgotPassword,
  forgotPasswordCode,
  passwordUpdated,
  sendLeaveRequestToCompany,
  sendSharedRequestToUser,
  sendreqCreated,
  sendmailadminres,
  sendLeaveStatusUpdate,
  sendReimbursementCreated,
  sendReimbursementStatusUpdate,
  sendTaskAssignedEmail,
  sendTaskStatusUpdate,
  sendFollowupReminder,
};
