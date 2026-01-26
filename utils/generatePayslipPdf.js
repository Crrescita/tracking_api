const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");

module.exports = async function generatePayslipPdf(data) {

  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  const logoUrl = `file://${data.logoPath}`;

  const templatePath = path.join(__dirname, "../views/payslip.ejs");
  const html = await ejs.renderFile(templatePath, {
    ...data,
    logoUrl,
    maxRows: Array.from({
      length: Math.max(data.earnings.length, data.deductions.length)
    })
  });

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfDir = path.join(__dirname, "../public/temp-pdf");
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const pdfPath = path.join(
    pdfDir,
    `payslip_${Date.now()}.pdf`
  );

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm" }
  });

  await browser.close();
  return pdfPath;
};
