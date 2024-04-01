require("dotenv").config();
const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const creds = require("./credentials.json");

// Create a new instance of the WebClient with your Slack token
const slackClient = new WebClient(process.env.SLACK_TOKEN);

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID,
  serviceAccountAuth
);

// Gets full profile details of the user
async function getUserProfile(userId) {
  try {
    const response = await slackClient.users.info({ user: userId });
    return response.user.profile;
  } catch (error) {
    console.error("Error occurred while getting user email:", error);
    throw error;
  }
}

// Listens to incoming messages that contain "in" or "signin"
app.message(/in|signin/i, async ({ message, say }) => {
  const helloMessage = `Hi <@${message.user}>,
Let's get you signed in for the day!`;

  await say({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: helloMessage,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Please select your work location",
        },
        accessory: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Select work location",
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "Work From Home",
              },
              value: "Work From Home",
            },
            {
              text: {
                type: "plain_text",
                text: "Work from Office",
              },
              value: "Work from Office",
            },
            {
              text: {
                type: "plain_text",
                text: "Client Location",
              },
              value: "Client Location",
            },
          ],
          action_id: "location-select",
        },
      },
    ],
    text: helloMessage,
  });
});

// Listens to the location-select action
app.action("location-select", async ({ body, ack, say }) => {
  await ack();
  await say({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Click the button to sign in.",
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Sign In",
          },
          value: `${body.actions[0].selected_option.value}`,
          action_id: "sign-in",
        },
      },
    ],
    text: "Click the button to sign in.",
  });
});

// Listens to the sign-in action
app.action("sign-in", async ({ body, ack, say }) => {
  const userProfileData = await getUserProfile(body.user.id);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Attendance"];

  const payload = {
    Name: userProfileData.real_name,
    Email: userProfileData.email,
    Date: new Date().toDateString(),
    Time: new Date().toLocaleTimeString(),
    Location: body.actions[0].value,
  };

  try {
    await ack();
    await sheet.addRow(payload);
    await say({
      text: `Sign in successful! Have a great day ahead.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Sign in successful! Have a great day ahead.`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error: ", error);
  }
});

(async () => {
  // Start your app
  await app.start();
  console.log("⚡️ Bolt app is running!");
})();
