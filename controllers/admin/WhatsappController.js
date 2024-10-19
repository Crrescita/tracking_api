const axios = require("axios");
// const users = [
//   {
//     name: "OM NARAAYAN BHAN",
//     mobile: "9267987785",
//     email: "ombhan@gmail.com",
//     password: "Naraayan@1974",
//   },
//   {
//     name: "Vishal Sharma",
//     mobile: "9871308531",
//     email: "vishal@abpal.com",
//     password: "Vishal@321",
//   },
//   {
//     name: "Damodar Sutradhar",
//     mobile: "9999931280",
//     email: "damodar@abpal.com",
//     password: "Damodar@321",
//   },
//   {
//     name: "Puneet Kumar",
//     mobile: "8826721245",
//     email: "sonupuneet.2009@gmail.com",
//     password: "Puneet@321",
//   },
//   {
//     name: "Satnam Singh",
//     mobile: "8447037041",
//     email: "satnam@abpal.com",
//     password: "Satnam@321",
//   },
//   {
//     name: "Upendra Singh",
//     mobile: "9479359759",
//     email: "upenthemaxsteel@gmail.com",
//     password: "Upendra@2018",
//   },
//   {
//     name: "Heera Kumar",
//     mobile: "9205334726",
//     email: "vishalheera254@gmail.com",
//     password: "Heera@123",
//   },
//   {
//     name: "Sanjay Sharma",
//     mobile: "9953357198",
//     email: "sanjay.sutrak69@gmail.com",
//     password: "Sanjay?0407",
//   },
//   {
//     name: "Gautam Kumar",
//     mobile: "9540093566",
//     email: "gautam@abpal.com",
//     password: "Guatam@1979",
//   },
//   {
//     name: "Hardeep Singh Sahni",
//     mobile: "9958630001",
//     email: "hardeep@abpal.com",
//     password: "Hardeep@1983",
//   },
//   {
//     name: "Yogender Kumar",
//     mobile: "9971724055",
//     email: "yogender@abpal.com",
//     password: "Yogender@2024",
//   },
//   {
//     name: "Dinesh Kumar Dedha",
//     mobile: "9310422958",
//     email: "dineshdedha@abpal.com",
//     password: "Dinesh@1981",
//   },
//   {
//     name: "Eshant Kumar",
//     mobile: "9761055099",
//     email: "eshant@abpal.com",
//     password: "Eshant@1989",
//   },
//   {
//     name: "Jitender Kumar",
//     mobile: "8800019108",
//     email: "jitender@abpal.com",
//     password: "Jitender@123",
//   },
//   {
//     name: "Rajan Arora",
//     mobile: "9818773838",
//     email: "rajanarora@abpal.com",
//     password: "Rajan@1978",
//   },
//   {
//     name: "Anil Kumar",
//     mobile: "9896544813",
//     email: "anilkumar@abpal.com",
//     password: "Anil@1983",
//   },
//   {
//     name: "Manpreet Singh",
//     mobile: "9810398003",
//     email: "manpreet.aps108@gmail.com",
//     password: "Manpreet@1977",
//   },
//   {
//     name: "Ankit Kumar Gupta",
//     mobile: "7011887215",
//     email: "ankitgupta.abpal@gmail.com",
//     password: "Ankit@2024",
//   },
//   {
//     name: "Joginder Kumar",
//     mobile: "8950356263",
//     email: "joginderkathuria12@gail.com",
//     password: "Joginder@2024",
//   },
//   {
//     name: "Amar Nath Tandon",
//     mobile: "9873419011",
//     email: "amar.tandon@abpal.com",
//     password: "Amar@2024",
//   },
//   {
//     name: "Prabodh Kumar Shivahare",
//     mobile: "9580861825",
//     email: "prabod@abpal.com",
//     password: "Prabodh@1985",
//   },
//   {
//     name: "Nandan Gupta",
//     mobile: "7376914523",
//     email: "upindia@abpal.com",
//     password: "Anand@1982",
//   },
//   {
//     name: "Amit Srivastava",
//     mobile: "7408886887",
//     email: "amit.srivastava@abpal.com",
//     password: "Amit@1984",
//   },
//   {
//     name: "Ravi Prakash Srivastava",
//     mobile: "9451462929",
//     email: "ravipra44@abpal.com",
//     password: "Ravi@1989",
//   },
//   {
//     name: "Gaurav Bishnoi",
//     mobile: "9910699836",
//     email: "gauravbishnoi.abpal@gmail.com",
//     password: "Gaurav@123",
//   },
//   {
//     name: "Narender Kumar Singh",
//     mobile: "9312706692",
//     email: "narendra@abpal.com",
//     password: "Narendra@123",
//   },
//   {
//     name: "Sanjiv Kumar Gupta",
//     mobile: "9667851819",
//     email: "sanjiv@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Manish Kumar Sharma",
//     mobile: "8285750021",
//     email: "manish@abpal.com",
//     password: "Manish@123",
//   },
//   {
//     name: "Viipin Kumar Alag",
//     mobile: "9971135727",
//     email: "abpal.vipinkumar@gmail.com",
//     password: "Vipin@123",
//   },
//   {
//     name: "Sanjeev Kumar Bhola",
//     mobile: "9718772929",
//     email: "abpalsanjeevbhola@gmail.com",
//     password: "Sanjeev@3211",
//   },
//   {
//     name: "Manish Singh",
//     mobile: "9310937528",
//     email: "manishsingh8228@gmail.com",
//     password: "Manish@123",
//   },
//   {
//     name: "Suraj Vij",
//     mobile: "8383819145",
//     email: "surajvij.7290@gmail.com",
//     password: "Suraj@321",
//   },
//   {
//     name: "Jatin Dhawan",
//     mobile: "9136337778",
//     email: "jatindhawan25@gmail.com",
//     password: "Jatin@321",
//   },
//   {
//     name: "Mohit Gupta",
//     mobile: "9990581157",
//     email: "mohit.tayalkbc@gmail.com",
//     password: "Mohit@321",
//   },
//   {
//     name: "Jasbir Singh",
//     mobile: "9871832086",
//     email: "jasbirjaggi1313@gmail.com",
//     password: "Jasbir@321",
//   },
//   {
//     name: "Gopalkrishna Mishra",
//     mobile: "8377887159",
//     email: "gopalkrishanmishra189@gmail.com",
//     password: "Gopal@321",
//   },
//   {
//     name: "Pankaj Kumar Mishra",
//     mobile: "9958879868",
//     email: "pankajmishasinindia@gmail.com",
//     password: "Pankaj@123",
//   },
//   {
//     name: "Abhishek Sharma",
//     mobile: "9654198585",
//     email: "abhishek.abpal@gmail.com",
//     password: "Abhishek@123",
//   },
//   {
//     name: "Bhagwat",
//     mobile: "9540445431",
//     email: "gothwanbhagwat@gmail.com",
//     password: "Bhawat@123",
//   },
//   {
//     name: "Dinesh Kumar Sah",
//     mobile: "9871303589",
//     email: "dinesh.sah34@gmail.com",
//     password: "Dinesh@123",
//   },
//   {
//     name: "Parveen",
//     mobile: "9810516646",
//     email: "parveen19oct.ps@gmail.com",
//     password: "Parveen@123",
//   },
//   {
//     name: "Chandan Kumar",
//     mobile: "8384068557",
//     email: "chandandiwali@gmail.com",
//     password: "Chandan@123",
//   },
//   {
//     name: "Munna Lal",
//     mobile: "9315809090",
//     email: "munnalal0570@gmail.com",
//     password: "Munnalal@123",
//   },
//   {
//     name: "Vijay Kumar",
//     mobile: "9899999791",
//     email: "vijaykumar240293@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "Satish Kumar",
//     mobile: "9971636456",
//     email: "satishkumar20050@gmail.com",
//     password: "Satish@321",
//   },
//   {
//     name: "Anil",
//     mobile: "9205332746",
//     email: "abpal.anil@gmail.com",
//     password: "Anil@123",
//   },
// ];

const users = [
  {
    name: "Upendra Singh",
    mobile: "9479359759",
    email: "upen@gamil.com",
    password: "testpassword@1974",
  },
  {
    name: "Sudhanshu Pal",
    mobile: "6265172538",
    email: "pal@abpal.com",
    password: "palpassword@321",
  },
];

exports.whatsapp = async (req, res, next) => {
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization:
      "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  const inviteLink = "https://appdistribution.firebase.dev/i/5f3680be56486c2e";

  for (let user of users) {
    // console.log(user);
    const body = {
      countryCode: "+91",
      phoneNumber: "",
      fullPhoneNumber: "+91" + user.mobile,
      campaignId: "",
      callbackData: "First Message",
      type: "Template",
      template: {
        name: "abpalinvite",
        languageCode: "en",
        // headerValues: [
        //   "https://telindia.s3.ap-south-1.amazonaws.com/abpalLogofinal.png",
        // ],
        bodyValues: [inviteLink, user.email, user.password],
      },
    };

    try {
      const response = await axios.post(apiUrl, body, { headers });
      console.log(`Message sent to ${user.mobile}:`, response.data);
      res.json({ message: response.data });
    } catch (error) {
      console.error(
        `Failed to send message to ${user.mobile}:`,
        error.response ? error.response.data : error.message
      );
      //   res.json({ message: error.message });
    }
  }
};
