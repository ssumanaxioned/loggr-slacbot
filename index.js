require("dotenv").config();
const { App, AwsLambdaReceiver } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const creds = require("./credentials.json");

// Create a new instance of the WebClient with your Slack token
const slackClient = new WebClient(process.env.SLACK_TOKEN);

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

// Checks if the user has already signed in for the day
async function checkSignedIn(email) {
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Attendance"];

  const currentDate = new Date().toDateString();
  const rows = await sheet.getRows();
  let isFound = false;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].get("Email") === email && rows[i].get("Date") === currentDate) {
      isFound = true;
      break;
    }
  }
  return isFound;
}

// Listens to incoming messages that contain "in" or "signin"
app.message(/in|signin/i, async ({ message, say }) => {
  const userProfileData = await getUserProfile(message.user);
  const isSignedIn = await checkSignedIn(userProfileData.email);
  
  if (isSignedIn) {
    await ack();
    await say({
      text: `You have already signed in for the day!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `You have already signed in for the day!`,
          },
        },
      ],
    });
    return;
  }

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
    const isSignedIn = await checkSignedIn(userProfileData.email);
    if (!isSignedIn) {
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
    } else {
      await say({
        text: `You have already signed in for the day!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You have already signed in for the day!`,
            },
          },
        ],
      });
    }
  } catch (error) {
    console.error("Error: ", error);
  }
});

module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};
