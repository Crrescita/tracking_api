function getCurrentDateTime() {
  const currentDate = new Date();

  const options = {
    timeZone: "Asia/Kolkata",
  };
  const year = currentDate.toLocaleString("en-US", { year: "numeric" });
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const hour = String(currentDate.getHours()).padStart(2, "0");
  const minute = String(currentDate.getMinutes()).padStart(2, "0");
  const second = String(currentDate.getSeconds()).padStart(2, "0");

  const formattedDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

  return formattedDateTime;
}

global.getCurrentDateTime = getCurrentDateTime;
