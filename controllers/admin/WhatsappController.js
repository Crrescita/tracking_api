const axios = require("axios");

// const users = [
  // {
  //   name: "Poonam",
  //   mobile: "7018630132",
  //   email: "poonam@abpal.com",
  //   password: "123456",
  // },
  // {
  //   name: "Pankaj",
  //   mobile: "9599785575",
  //   email: "pankaj.abpal@gmail.com",
  //   password: "123456",
  // },
  // {
  //   name: "Gurneet",
  //   mobile: "9821298537",
  //   email: "gurneet.abpal@gmail.com",
  //   password: "123456",
  // },
  // {
  //   name: "Shyam Singh",
  //   mobile: "9537247158",
  //   email: "shyam.singh@gamil.com",
  //   password: "123456",
  // },
  // {
  //   name: "Vansh Mishra",
  //   mobile: "9821868971",
  //   email: "vansh.mishra@abpal.com",
  //   password: "123456",
  // },

  // {
  //   name: "OM NARAAYAN BHAN",
  //   mobile: "9267987785",
  //   email: "ombhan@gmail.com",
  //   password: "Naraayan@1974",
  // },
  // {
  //   name: "Vishal Sharma",
  //   mobile: "9871308531",
  //   email: "vishal@abpal.com",
  //   password: "Vishal@321",
  // },
  // {
  //   name: "Damodar Sutradhar",
  //   mobile: "9999931280",
  //   email: "damodar@abpal.com",
  //   password: "Damodar@321",
  // },
  // {
  //   name: "Puneet Kumar",
  //   mobile: "8826721245",
  //   email: "sonupuneet.2009@gmail.com",
  //   password: "Puneet@321",
  // },
  // {
  //   name: "Satnam Singh",
  //   mobile: "8447037041",
  //   email: "satnam@abpal.com",
  //   password: "Satnam@321",
  // },
  // {
  //   name: "Upendra Singh",
  //   mobile: "9479359759",
  //   email: "upenthemaxsteel@gmail.com",
  //   password: "Upendra@2018",
  // },
  // {
  //   name: "Heera Kumar",
  //   mobile: "9205334726",
  //   email: "vishalheera254@gmail.com",
  //   password: "Heera@123",
  // },
  // {
  //   name: "Sanjay Sharma",
  //   mobile: "9953357198",
  //   email: "sanjay.sutrak69@gmail.com",
  //   password: "Sanjay?0407",
  // },
  // {
  //   name: "Gautam Kumar",
  //   mobile: "9540093566",
  //   email: "gautam@abpal.com",
  //   password: "Guatam@1979",
  // },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
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
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
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
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
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
//   {
//     name: "Ravinder Kaur",
//     mobile: "9911706963",
//     email: "ravinderkaur@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SANDEEP KUMAR",
//     mobile: "9625255052",
//     email: "bank@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SHOBHNA KHANNA",
//     mobile: "9971423376",
//     email: "shobhnakhanna@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "M.P. SINGH",
//     mobile: "9582085860",
//     email: "mp@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "ARUN KHANNA",
//     mobile: "9211072983",
//     email: "arun@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "RAVINDER KAUR",
//     mobile: "9911706863",
//     email: "ravinderkaur@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "ANJU",
//     mobile: "7982459197",
//     email: "sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "KAMAL KUMAR ARORA",
//     mobile: "9990491492",
//     email: "kamal@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "MANALI",
//     mobile: "9999707608",
//     email: "manali@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "AKHILESH KUMAR",
//     mobile: "8376964372",
//     email: "akhilesh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "BHUMESH KUMAR SHARMA",
//     mobile: "9756157125",
//     email: "bhumesh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SANJEEV KUMAR",
//     mobile: "9312643379",
//     email: "sanjeev@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SANDEEP KUMAR",
//     mobile: "9582184060",
//     email: "bank@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "DEEPIKA GUPTA",
//     mobile: "9643472072",
//     email: "cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "CHIRAG BALI",
//     mobile: "8595735698",
//     email: "chirag.sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "AJAY KUMAR",
//     mobile: "8826473609",
//     email: "ajay.sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SUNITA NEGI",
//     mobile: "9873554143",
//     email: "sunita@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "DEEPIKA TANWAR",
//     mobile: "9582899271",
//     email: "deepika@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "DHANRAJ SINGH",
//     mobile: "9654495008",
//     email: "dhanraj@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "TUSHAR MISHRA",
//     mobile: "9899999317",
//     email: "tushar@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SUPERNA CHANDRA",
//     mobile: "7001009427",
//     email: "superna.sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "RUCHI",
//     mobile: "8447215815",
//     email: "ruchi@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PAPPU KUMAR",
//     mobile: "9871595308",
//     email: "pappu.sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "CHANCHAL",
//     mobile: "9582805020",
//     email: "payment@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "HARPREET KAUR",
//     mobile: "7827130693",
//     email: "harpeet.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "N.K. SOOD",
//     mobile: "9818519969",
//     email: "nksood@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PRAVEEN KUMAR",
//     mobile: "9211093259",
//     email: "praveen@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "HARLEEN KAUR",
//     mobile: "8920283010",
//     email: "harleen.kaur@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SANJEEV CHOUDHARY",
//     mobile: "9013268587",
//     email: "docs@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "MAHIPAL SINGH",
//     mobile: "9718253684",
//     email: "mahipalcomputers@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "PUNEET KUMAR",
//     mobile: "7983406641",
//     email: "purchase@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PRABHAT SHARMA",
//     mobile: "9536937103",
//     email: "prabhat.docs@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "VIVEK DUBEY",
//     mobile: "9811188367",
//     email: "vivek@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "SHASHI SHEKHAR JHA",
//     mobile: "8851470204",
//     email: "shashi@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SUNEEL KUMAR MISHRA",
//     mobile: "9871379336",
//     email: "suneel@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "NARENDRA SINGH RANA",
//     mobile: "9560669148",
//     email: "bajaj@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "LALIT SHARMA",
//     mobile: "8376036874",
//     email: "lalit@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "AJIT BHATNAGAR",
//     mobile: "9212111603",
//     email: "ajit@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "KAPIL",
//     mobile: "8287575342",
//     email: "kapil@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "VIVEKANAND SHARMA",
//     mobile: "9654658678",
//     email: "vivekanand@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "BUDH RAM (SURAJ)",
//     mobile: "8505819414",
//     email: "budhram@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "MATADIN TIWARI",
//     mobile: "9311325147",
//     email: "matadin@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "RAMESH",
//     mobile: "8601744166",
//     email: "ramesh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "BHAGWAN DASS",
//     mobile: "8700783362",
//     email: "bhagwandas@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "KULDEEP",
//     mobile: "9821109754",
//     email: "kuldeep@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "MOHIT",
//     mobile: "9315202740",
//     email: "mohit@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SUJATA",
//     mobile: "8287607906",
//     email: "sujata.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "MANISHA",
//     mobile: "9289110553",
//     email: "manisha.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "MAMTA",
//     mobile: "9310531278",
//     email: "mamta.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PRIYANSHI",
//     mobile: "9509515329",
//     email: "priyanshi.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "DEEPIKA",
//     mobile: "9643472072",
//     email: "deepika.cct@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SUNIL SINGH",
//     mobile: "9811934874",
//     email: "sunil@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "RANJEET MISHRA",
//     mobile: "9971747700",
//     email: "ranjeet@abpal.com",
//     password: "123456",
//   },

//   {
//     name: "CHIRJEEV KAUR",
//     mobile: "8860176064",
//     email: "kaur.chirjeev10@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "NILESH KUMAR",
//     mobile: "8595294903",
//     email: "nilesh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PANKAJ",
//     mobile: "7289071320",
//     email: "pankaj@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "AMIT",
//     mobile: "9667028183",
//     email: "amit@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "LAL MOHD.",
//     mobile: "9971166598",
//     email: "lal.mohd@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "UPENDER KUMAR",
//     mobile: "9971764735",
//     email: "upender@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SHYAM SINGH",
//     mobile: "9811693707",
//     email: "shyam.singh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PRIYANKA ARORA",
//     mobile: "9910537954",
//     email: "priyanka@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "YOGESH RASTOGI",
//     mobile: "9891928489",
//     email: "yogesh.rastogi@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "JITENDER SAINI",
//     mobile: "9811691742",
//     email: "jitendra.saini@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PANKAJ KUMAR",
//     mobile: "9717071910",
//     email: "pankaj.muz001@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "NARENDER KUMAR",
//     mobile: "9266530844",
//     email: "bhawna@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "PRADEEP KUMAR SINGH",
//     mobile: "9818749100",
//     email: "pradeep@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "JAMSED",
//     mobile: "9810376024",
//     email: "jamsed@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "VIPIN SINGH",
//     mobile: "9599785572",
//     email: "vipin@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SATISH KUMAR YADAV",
//     mobile: "7683070301",
//     email: "satish.docs@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "VIMAL KUMAR",
//     mobile: "8383853879",
//     email: "vimal.docs@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "CHANDRESH",
//     mobile: "7838625937",
//     email: "chandresh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SHARWAN",
//     mobile: "7838156329",
//     email: "sharwan@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SWATI CHAWLA",
//     mobile: "8700591920",
//     email: "swati@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SONALI BISHT",
//     mobile: "9205487358",
//     email: "sonaliabpal@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "SAKSHI",
//     mobile: "9310226188",
//     email: "sakshi@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "SHAFALI",
//     mobile: "9891476718",
//     email: "shafali.sales@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "ANKUR TIWARI",
//     mobile: "8929308885",
//     email: "ankur@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
// ];

// const users = [
//   {
//     name: "Yogesh Kumar",
//     mobile: "9818015762",
//     email: "ritika@abpal.com",
//     password: "123456",
//   },

//   {
//     name: "Sharvan",
//     mobile: "8860712896",
//     email: "sharvan@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Ashutosh Kumar Pandey",
//     mobile: "8448346309",
//     email: "ashutosh@abpal.com",
//     password: "123456",
//   },
//   {
//     name: "Sudhanshu Pal",
//     mobile: "6265172538",
//     email: "checknewpal@abpal.com",
//     password: "palsword@321",
//   },
//   {
//     name: "Bhumesh Sharma",
//     mobile: "9540573483",
//     email: "bhumeshsharma916@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "Aman",
//     mobile: "7210603112",
//     email: "as6049607@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "Parul Malik",
//     mobile: "8750080839",
//     email: "parulmalik1417@gmail.com",
//     password: "123456",
//   },
//   {
//     name: "Mohan Hira",
//     mobile: "9540021439",
//     email: "mhira162@gmail.com",
//     password: "123456",
//   },
// ];


// 22 may 2025
const users = [
  // {
  //   name: "Vishal Sharma",
  //   mobile: "9871308531"
  // },
  // {
  //   name: "Damodar Sutradhar",
  //   mobile: "9999931280"
  // },
  // {
  //   name: "Puneet Kumar",
  //   mobile: "8826721245"
  // },
  // {
  //   name: "Upendra Singh Bhati",
  //   mobile: "9479359759"
  // },
  // {
  //   name: "Heera Kumar",
  //   mobile: "9205334726"
  // },
  // {
  //   name: "Sanjay Sharma",
  //   mobile: "9953357198"
  // },
  // {
  //   name: "Hardeep Singh Sahni",
  //   mobile: "9958630001"
  // },
  // {
  //   name: "Yogender Kumar",
  //   mobile: "9971724055"
  // },
  // {
  //   name: "Dinesh Kumar Dedha",
  //   mobile: "9310422958"
  // },
  // {
  //   name: "Jitender Kumar",
  //   mobile: "8800019108"
  // },
  // {
  //   name: "Rajan Arora",
  //   mobile: "9818773838"
  // },
  // {
  //   name: "Anil Kumar",
  //   mobile: "9896544813"
  // },
  // {
  //   name: "Manpreet Singh",
  //   mobile: "9810398003"
  // },
  // {
  //   name: "Amar Nath Tandon",
  //   mobile: "9873419011"
  // },
  // {
  //   name: "Prabodh Kumar Shivahare",
  //   mobile: "9580861825"
  // },
  // {
  //   name: "Nandan Gupta",
  //   mobile: "7376914523"
  // },
  // {
  //   name: "Amit Srivastava",
  //   mobile: "7408886887"
  // },
  // {
  //   name: "Ravi Prakash Srivastava",
  //   mobile: "9451462929"
  // },
  // {
  //   name: "Gaurav Bishnoi",
  //   mobile: "9910699836"
  // },
  // {
  //   name: "Narender Kumar Singh",
  //   mobile: "9312706692"
  // },
  // {
  //   name: "Manish Kumar Sharma",
  //   mobile: "8285750021"
  // },
  // {
  //   name: "Viipin Kumar Alag",
  //   mobile: "9971135727"
  // },
  // {
  //   name: "Sanjeev Kumar Bhola",
  //   mobile: "9718772929"
  // },
  // {
  //   name: "Suraj Vij",
  //   mobile: "8383819145"
  // },
  // {
  //   name: "Jatin Dhawan",
  //   mobile: "9136337778"
  // },
  // {
  //   name: "Mohit Gupta",
  //   mobile: "9990581157"
  // },
  // {
  //   name: "Jasbir Singh",
  //   mobile: "9871832086"
  // },
  // {
  //   name: "Gopalkrishna Mishra",
  //   mobile: "8377887159"
  // },
  // {
  //   name: "Pankaj Kumar Mishra",
  //   mobile: "9958879868"
  // },
  // {
  //   name: "Abhishek Sharma",
  //   mobile: "9654198585"
  // },
  // {
  //   name: "Bhagwat",
  //   mobile: "9540445431"
  // },
  // {
  //   name: "Dinesh Kumar Sah",
  //   mobile: "9871303589"
  // },
  // {
  //   name: "Parveen",
  //   mobile: "9810516646"
  // },
  // {
  //   name: "Munna Lal",
  //   mobile: "9315809090"
  // },
  // {
  //   name: "Satish Kumar",
  //   mobile: "9971636456"
  // },
  // {
  //   name: "Anil",
  //   mobile: "9205332746"
  // },
  // {
  //   name: "Shobhna Khanna",
  //   mobile: "9971423376"
  // },
  // {
  //   name: "M.P. Singh",
  //   mobile: "9582085860"
  // },
  // {
  //   name: "Arun Khanna",
  //   mobile: "9211072983"
  // },
  // {
  //   name: "Ravinder Kaur",
  //   mobile: "9911706963"
  // },
  {
    name: "Kamal Kumar Arora",
    mobile: "9990491492"
  },
  {
    name: "Manali",
    mobile: "9999707608"
  },
  {
    name: "Bhumesh Kumar Sharma",
    mobile: "9756157125"
  },
  {
    name: "Deepika Gupta",
    mobile: "9643472072"
  },
  {
    name: "Chirag Bali",
    mobile: "8595735698"
  },
  {
    name: "Ajay Kumar",
    mobile: "8826473609"
  },
  {
    name: "Sunita Negi",
    mobile: "9873554143"
  },
  {
    name: "Deepika Tanwar",
    mobile: "9582899271"
  },
  {
    name: "Ankur Tiwari",
    mobile: "8929308885"
  },
  {
    name: "Dhanraj Singh",
    mobile: "9654495008"
  },
  {
    name: "Tushar Mishra",
    mobile: "9899999317"
  },
  {
    name: "Shefali",
    mobile: "9891476718"
  },
  {
    name: "Superna Chandra",
    mobile: "7001009427"
  },
  {
    name: "Sakshi",
    mobile: "9310226188"
  },
  {
    name: "Ruchi",
    mobile: "8447215815"
  },
  {
    name: "Pappu Kumar",
    mobile: "9871595308"
  },
  {
    name: "Sonali Bisht",
    mobile: "9205487358"
  },
  {
    name: "Chanchal",
    mobile: "9582805020"
  },
  {
    name: "Swati Chawla",
    mobile: "8700591920"
  },
  {
    name: "N.K. Sood",
    mobile: "9818519969"
  },
  {
    name: "Sharwan",
    mobile: "7838156329"
  },
  {
    name: "Praveen Kumar",
    mobile: "9211093259"
  },
  {
    name: "Chandresh",
    mobile: "7838625937"
  },
  {
    name: "Mahipal Singh",
    mobile: "9718253684"
  },
  {
    name: "Vimal Kumar",
    mobile: "8383853879"
  },
  {
    name: "Puneet Kumar",
    mobile: "7983406641"
  },
  {
    name: "Satish Kumar Yadav",
    mobile: "7683070301"
  },
  {
    name: "Prabhat Sharma",
    mobile: "9536937103"
  }
];



exports.whatsapp = async (req, res, next) => {

  const { users } = req.body;
  console.log(users);
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization:
      "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  // const inviteLink = "https://appdistribution.firebase.dev/i/5f3680be56486c2e";
  // const inviteLink =
  //   " https://drive.google.com/file/d/1E2cVqvTm1v5j8jNJ1n5y8HVjB9PcP3n9/view?usp=sharing";
  // const inviteLink =
  //   "https://drive.google.com/file/d/1WZGYyL017eqUhvVLHVUPX0Hxg4beTsyw/view";
  const inviteLink =
    "https://drive.google.com/file/d/1pbIHQ0o_WXFPdZ_vdpXiPD0gDiMnhGah/view";

  const imageurl =
    "https://telindia.s3.ap-south-1.amazonaws.com/abpal51year/WhatsApp+Image+2024-11-15+at+5.10.19+PM.jpeg";
  const playstoreLink =
    "https://play.google.com/store/apps/details?id=com.crrescita.telapp&pcampaignid=web_share";
  for (let user of users) {
    const body = {
      countryCode: "+91",
      phoneNumber: "",
      fullPhoneNumber: "+91" + user.mobile,
      campaignId: "",
      callbackData: "First Message",
      type: "Template",
      template: {
        // invite = abpalinvite_lu
        // checkinalert = checkinalert
        // abpal51year
        // checking issue = Check_In_update
        // app dist = new_app_distribute
        // play store = playsotre_app_notification
        //final_reminder = final_reminder
        // tel_ios_invite = tel_ios_invite
        name: "checkinalert",
        languageCode: "en",
        headerValues: [
          "https://telindia.s3.ap-south-1.amazonaws.com/abpal51year/WhatsApp+Image+2024-11-15+at+5.10.19+PM.jpeg",
        ],
        // bodyValues: [user.name, inviteLink, user.email, user.password],
        bodyValues: [user.name],
        // bodyValues: [user.name, playstoreLink, user.email, user.password],
        // bodyValues: [user.email, user.password],
      },
    };

    try {
      const response = await axios.post(apiUrl, body, { headers });
      console.log(`Message sent to ${user.name} ${user.mobile}:`, response.data);
      //   res.json({ message: response.data });
    } catch (error) {
      console.error(
        `Failed to send message to ${user.name} => ${user.mobile}:`,
        error.response ? error.response.data : error.message
      );
      //   res.json({ message: error.message });
    }
    //
  }
  res.json({ message: "sent" });
};



// const axios = require("axios");

exports.whatsappBulk = async (req, res, next) => {
  const { users } = req.body;
  const apiUrl = "https://api.interakt.ai/v1/public/message/";
  const headers = {
    Authorization: "Basic ZjlnbVJyTzkzRzAxc2MzTEdxcjVDV3pvMmtDS0pHUzhleVZOVEhQMGlPQTo=",
    "Content-Type": "application/json",
  };

  const imageurl = "https://telindia.s3.ap-south-1.amazonaws.com/abpal51year/WhatsApp+Image+2024-11-15+at+5.10.19+PM.jpeg";
  const batchSize = 15;
  const failedUsers = [];
  let successCount = 0;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const sendMessage = async (user) => {
    const body = {
      countryCode: "+91",
      phoneNumber: "",
      fullPhoneNumber: "+91" + user.mobile,
      campaignId: "",
      callbackData: "First Message",
      type: "Template",
      template: {
        name: "checkinalert",
        languageCode: "en",
        headerValues: [imageurl],
        bodyValues: [user.name],
      },
    };

    try {
      const response = await axios.post(apiUrl, body, { headers });
      console.log(`✅ Sent: ${user.name} - ${user.mobile}`);
      successCount++;
      return true;
    } catch (error) {
      console.error(`❌ Failed: ${user.name} - ${user.mobile}`, error?.response?.data || error.message);
      failedUsers.push(user);
      return false;
    }
  };

  const processBatch = async (userList, attempt = 1) => {
    console.log(`🚀 Attempt ${attempt} - Users: ${userList.length}`);

    for (let i = 0; i < userList.length; i += batchSize) {
      const batch = userList.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          await sendMessage(user);
          await delay(200); // slight delay between messages
        })
      );

      await delay(2000); // delay between batches
    }
  };

  await processBatch(users, 1);

  if (failedUsers.length > 0) {
    console.log(`Retrying ${failedUsers.length} after 10s`);
    await delay(10000);

    const retryUsers = [...failedUsers];
    failedUsers.length = 0;
    await processBatch(retryUsers, 2);
  }

  res.json({
    message: "WhatsApp bulk messaging completed.",
    total: users.length,
    sent: successCount,
    failed: failedUsers.length,
    failedUsers,
  });
};

