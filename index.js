const { App, AwsLambdaReceiver } = require("@slack/bolt");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const creds = require("./credentials.json");

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
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
app.action(
  "sign-in",
  async ({ body, ack, say, payload, client, action, respond }) => {
    const userProfileData = await client.users.info({ user: body.user.id });
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[process.env.SHEET_NAME];

    const indianTimeZoneOffset =
      process.env.SHEET_NAME === "Development" ? 0 : -330; // GMT+5:30

    const timezoneOffset = indianTimeZoneOffset * 60000; // Get the timezone offset in milliseconds
    const localDate = new Date(Date.now() - timezoneOffset); // Get the local date and time
    const dataToSend = {
      Name: userProfileData.user.real_name,
      Email: userProfileData.user.profile.email,
      Date: localDate.toLocaleDateString(),
      Time: localDate.toLocaleTimeString(),
      Location: payload.value,
    };

    try {
      await ack();

      setTimeout(async () => {
        await sheet.addRow(dataToSend);
      }, 0);

      if (action.type === "button") {
        await respond(
          `You've selected: ${payload.value}.
Sign in successful! Have a great day ahead.`
        );
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  }
);

module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};
