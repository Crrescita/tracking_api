const axios = require("axios");

async function inviteLinkToEmp(data) {
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization:
      "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  // const inviteLink = "https://appdistribution.firebase.dev/i/5f3680be56486c2e";
  // const inviteLink =
  //   " https://drive.google.com/file/d/1E2cVqvTm1v5j8jNJ1n5y8HVjB9PcP3n9/view?usp=sharing";
  const inviteLink =
    "https://drive.google.com/file/d/1WZGYyL017eqUhvVLHVUPX0Hxg4beTsyw/view";

  const body = {
    countryCode: "+91",
    phoneNumber: "",
    fullPhoneNumber: "+91" + data.mobile,
    campaignId: "",
    callbackData: "First Message",
    type: "Template",
    template: {
      // invite = abpalinvite_lu
      // checkinalert = checkinalert
      name: "abpalinvite_lu",
      languageCode: "en",
      headerValues: [
        "https://telindia.s3.ap-south-1.amazonaws.com/abpalLogofinal.png",
      ],
      bodyValues: [inviteLink, data.email, data.password],
      // bodyValues: [user.email, user.password],
    },
  };

  try {
    const response = await axios.post(apiUrl, body, { headers });
    console.log(`Message sent to ${data.mobile}:`, response.data);
    //   res.json({ message: response.data });
  } catch (error) {
    console.error(
      `Failed to send message to ${data.mobile}:`,
      error.response ? error.response.data : error.message
    );
    //   res.json({ message: error.message });
  }
  //

  res.json({ message: "sent" });
}

async function taskAssigned(data) {
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization:
      "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  const inviteLink = `${process.env.WEBSITE_BASE_URL}pages/task/${data.emp_id}/${data.task_id}`;


  const body = {
    countryCode: "+91",
    phoneNumber: "",
    fullPhoneNumber: "+91" + data.mobile,
    campaignId: "",
    callbackData: "First Message",
    type: "Template",
    template: {
      name: "assign_task",
      languageCode: "en",
      headerValues: [
        "https://telindia.s3.ap-south-1.amazonaws.com/abpalLogofinal.png",
      ],
      bodyValues: [data.name, data.task_title, data.start_date, data.end_date,  inviteLink],
    },
  };

  try {
    const response = await axios.post(apiUrl, body, { headers });
    console.log(`Message sent to ${data.mobile}:`, response.data);
    //   res.json({ message: response.data });
  } catch (error) {
    console.error(
      `Failed to send message to ${data.mobile}:`,
      error.response ? error.response.data : error.message
    );
  }
  // res.json({ message: "sent" });
}

// async function taskReminderUpdate(data) {
//   const apiUrl = "https://api.interakt.ai/v1/public/message/";
//   const headers = {
//     Authorization:
//       "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
//     "Content-Type": "application/json",
//   };

//   const inviteLink = `http://localhost:4200/pages/task/${data.emp_id}/${data.task_id}`;


//   const body = {
//     countryCode: "+91",
//     phoneNumber: "",
//     fullPhoneNumber: "+91" + data.mobile,
//     campaignId: "",
//     callbackData: "First Message",
//     type: "Template",
//     template: {
//       name: "assign_task_reminder",
//       languageCode: "en_US",
//       headerValues: [
//         "https://telindia.s3.ap-south-1.amazonaws.com/abpalLogofinal.png",
//       ],
//       bodyValues: [data.name, data.task_title, data.start_date, data.end_date,data.message, inviteLink],
//     },
//   };

//   try {
//     const response = await axios.post(apiUrl, body, { headers });
//     console.log(`Message sent to ${data.mobile}:`, response.data);
//     //   res.json({ message: response.data });
//   } catch (error) {
//     console.error(
//       `Failed to send message to ${data.mobile}:`,
//       error.response ? error.response.data : error.message
//     );
//   }
//   // res.json({ message: "sent" });
// }


async function taskReminderUpdate(data) {
  console.log(data)
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization: "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  const inviteLink = `${process.env.WEBSITE_BASE_URL}pages/task/${data.emp_id}/${data.task_id}`;

  const body = {
    countryCode: "+91",
    phoneNumber: "",
    fullPhoneNumber: "+91" + data.mobile,
    campaignId: "",
    callbackData: "First Message",
    type: "Template",
    template: {
      name: "assign_task_reminder",
      languageCode: "en_US",
      headerValues: [
        "https://telindia.s3.ap-south-1.amazonaws.com/abpalLogofinal.png",
      ],
      bodyValues: [
        data.name,
        data.task_title,
        data.status,
        data.start_date,
        data.end_date,
        data.message,
        inviteLink
      ],
    },
  };

  try {
    const response = await axios.post(apiUrl, body, { headers });
    console.log(`Message sent to ${data.mobile}:`, response.data);
  } catch (error) {
    console.error(
      `Failed to send message to ${data.mobile}:`,
      error.response ? error.response.data : error.message
    );
  }
}



module.exports = {
  inviteLinkToEmp,
  taskAssigned,
  taskReminderUpdate
};
