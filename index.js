require("dotenv").config();
const { App, AwsLambdaReceiver } = require("@slack/bolt");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const { format } = require("date-fns");

const creds = require("./credentials.json");

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_TOKEN,
  receiver: awsLambdaReceiver,
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
app.action("location-select", async ({ ack, say, payload }) => {
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
          value: `${payload.selected_option.value}`,
          action_id: "sign-in",
        },
      },
    ],
    text: "Click the button to sign in.",
  });
});

// Listens to the sign-in action
app.action("sign-in", async ({ body, ack, say, payload, client }) => {
  const userProfileData = await client.users.info({ user: body.user.id });
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Attendance"];
  const dateFromUser = new Date();
  const date = format(dateFromUser, "yyyy-MM-dd");
  const time = format(dateFromUser, "HH:mm:ss");

  const dataToSend = {
    Name: userProfileData.user.real_name,
    Email: userProfileData.user.profile.email,
    Date: date,
    Time: time,
    Location: payload.value,
  };

  try {
    await ack();
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
    await sheet.addRow(dataToSend);
  } catch (error) {
    console.error("Error: ", error);
  }
});

module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};
