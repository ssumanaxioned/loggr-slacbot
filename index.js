require("dotenv").config();
const { App, AwsLambdaReceiver } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const creds = require("./credentials.json");

const slackClient = new WebClient(process.env.SLACK_TOKEN);
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

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
let sheetCache = null;

async function getUserProfile(userId) {
  try {
    const response = await slackClient.users.info({ user: userId });
    return response.user.profile;
  } catch (error) {
    console.error("Error occurred while getting user profile:", error);
    throw error;
  }
}

async function checkSignedIn(email) {
  if (!sheetCache) await loadSheet();
  const currentDate = new Date().toDateString();
  return sheetCache.some(
    (row) => row.Email === email && row.Date === currentDate
  );
}

async function loadSheet() {
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Attendance"];
  const rows = await sheet.getRows();
  sheetCache = rows;
}

app.message(/in|signin/i, async ({ message, say }) => {
  const userProfileDataPromise = getUserProfile(message.user);
  const isSignedInPromise = userProfileDataPromise.then((data) =>
    checkSignedIn(data.email)
  );

  const [userProfileData, isSignedIn] = await Promise.all([
    userProfileDataPromise,
    isSignedInPromise,
  ]);

  if (isSignedIn) {
    await say({
      text: `You have already signed in for the day!`,
    });
    return;
  }

  const helloMessage = `Hi <@${message.user}>, Let's get you signed in for the day!`;

  await say({
    text: helloMessage,
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
  });
});

app.action("location-select", async ({ body, ack, say }) => {
  await ack();
  await say({
    text: "Click the button to sign in.",
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
          value: body.actions[0].selected_option.value,
          action_id: "sign-in",
        },
      },
    ],
  });
});

app.action("sign-in", async ({ body, ack, say }) => {
  const userProfileDataPromise = getUserProfile(body.user.id);
  const isSignedInPromise = userProfileDataPromise.then((data) =>
    checkSignedIn(data.email)
  );

  const [userProfileData, isSignedIn] = await Promise.all([
    userProfileDataPromise,
    isSignedInPromise,
  ]);

  if (!isSignedIn) {
    const payload = {
      Name: userProfileData.real_name,
      Email: userProfileData.email,
      Date: new Date().toDateString(),
      Time: new Date().toLocaleTimeString(),
      Location: body.actions[0].value,
    };

    try {
      if (!sheetCache) await loadSheet();
      const sheet = doc.sheetsByTitle["Attendance"];
      await sheet.addRow(payload);
      await ack();
      await say({
        text: `Sign in successful! Have a great day ahead.`,
      });
    } catch (error) {
      console.error("Error occurred while signing in:", error);
    }
  } else {
    await ack();
    await say({
      text: `You have already signed in for the day!`,
    });
  }
});

module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};
