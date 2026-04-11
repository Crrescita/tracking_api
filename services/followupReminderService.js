const admin = require("../firebase");
const sqlModel = require("../config/db");
const { getCurrentDateTime } = require("../config/datetime");
const sendMail = require("../mail/nodemailer");

/**
 * Follow-Up Reminder Service
 * --------------------------
 * Runs daily at 3 PM IST.
 * Checks if any request's nextFollowup_date matches today's date.
 * If yes:
 *   1. Updates nextFollowup to "Pending"
 *   2. Sends email reminder to the employee
 *   3. Sends FCM push notification to the employee
 */

exports.checkFollowupReminders = async () => {
  try {
    console.log("📅 Starting follow-up reminder check at:", new Date().toISOString());

    // Fetch all requests where nextFollowup_date is today and nextFollowup is NOT already Pending/Closed
    const requests = await sqlModel.customQuery(`
      SELECT 
        r.id AS request_id,
        r.emp_id,
        r.company_id,
        r.type,
        r.title,
        r.description,
        r.nextFollowup,
        r.nextFollowup_date,
        e.name AS employee_name,
        e.email AS employee_email,
        e.fcm_token
      FROM requests r
      JOIN employees e ON e.id = r.emp_id
      WHERE DATE(r.nextFollowup_date) = CURDATE()
        AND r.nextFollowup != 'Pending'
        AND r.nextFollowup != 'Closed'
        AND r.nextFollowup_date IS NOT NULL 
    `);

    if (!requests.length) {
      console.log("ℹ️ No follow-up reminders due today.");
      return;
    }

    console.log(`📊 Found ${requests.length} requests with follow-ups due today.`);

    for (const req of requests) {
      try {
        console.log(`[PROCESS] Request #${req.request_id} (${req.type}) for Emp ${req.emp_id} (${req.employee_name})`);

        // 1. Update nextFollowup to Pending
        await sqlModel.update(
          "requests",
          {
            nextFollowup: "Pending",
            updated_at: getCurrentDateTime(),
          },
          { id: req.request_id }
        );
        console.log(`  ✅ Updated nextFollowup to "Pending"`);

        // 2. Send Email
        if (req.employee_email) {
          try {
            await sendMail.sendFollowupReminder({
              email: req.employee_email,
              employee_name: req.employee_name,
              request_id: req.request_id,
              type: req.type || "N/A",
              title: req.title || "N/A",
              followup_date: req.nextFollowup_date,
              previous_followup: req.nextFollowup || "N/A",
            });
            console.log(`  ✉️ Email sent to ${req.employee_email}`);
          } catch (emailErr) {
            console.error(`  ❌ Email FAILED for Emp ${req.emp_id}:`, emailErr.message);
          }
        } else {
          console.log(`  ⚠️ No email found for Emp ${req.emp_id}. Skipping email.`);
        }

        // 3. Send FCM Push Notification
        if (req.fcm_token) {
          const notifTitle = "Follow-Up Reminder-" + req.title;
          const notifBody = `Your ${req.type || ""} follow-up for "${req.title || "request"}" is due today. Please update in the T.E.L App.`;

          try {
            const fcmRes = await admin.messaging().send({
              token: req.fcm_token,
              notification: {
                title: notifTitle,
                body: notifBody,
              },
              data: {
                "screen": "quotation_detail",
                requestId: req.request_id.toString(),
                source: "followup",
                followup: "Pending",
                title: notifTitle,
                body: notifBody,
              },
              android: {
                priority: "high",
                notification: {
                  channel_id: "high_importance_channel",
                  sound: "default",
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    contentAvailable: true,
                  },
                },
                headers: {
                  "apns-priority": "10",
                },
              },
            });
            console.log(`  🔔 Notification sent to ${req.employee_name}. MessageID: ${fcmRes}`);
          } catch (notifErr) {
            console.error(`  ❌ Notification FAILED for Emp ${req.emp_id}:`, notifErr.message);
          }
        } else {
          console.log(`  ⚠️ No FCM token found for Emp ${req.emp_id}. Skipping notification.`);
        }

      } catch (reqErr) {
        console.error(`❌ Error processing Request #${req.request_id}:`, reqErr.message);
      }
    }

    console.log("✅ Follow-up reminder check completed.");

  } catch (err) {
    console.error("❌ Follow-up reminder CRITICAL error:", err);
  }
};
