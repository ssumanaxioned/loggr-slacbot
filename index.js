const { App } = require('@slack/bolt');

const { WebClient } = require('@slack/web-api');

// Create a new instance of the WebClient with your Slack token
const slackClient = new WebClient('xoxb-6655150710438-6675550054305-zMFDpAkEveGtFJOaEdjUmVs6');
let userEmail = '';
// Define a function to get the email ID of a user
async function getUserEmail(userId) {
  try {
    // Call the users.info method with the user ID
    const response = await slackClient.users.info({ user: userId });

    // Extract the email ID from the response
    userEmail = response.user.profile.email;
    console.log("🚀 ~ getUserEmail ~ email:", userEmail)
  } catch (error) {
    console.error('Error occurred while getting user email:', error);
    throw error;
  }
}

// Initializes your app with your bot token and signing secret
const app = new App({
  token: "xoxb-6655150710438-6675550054305-zMFDpAkEveGtFJOaEdjUmVs6",
  signingSecret: "318df0660a4cc082f32caa75e0d592b5",
  socketMode: true, // add this
  appToken: 'xapp-1-A06KGA3PBPC-6698772477712-ac37d3211fa93e6aff7746d7636739a27707b07d04de3cebce3ca7f072565bd2' // add this
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {

  await getUserEmail(message.user);
  // say() sends a message to the channel where the event was triggered
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Hey there :wave: I'm LoggrBot. I'm here to help you sign in to loggr for the day"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Tell us your work location"
        },
        "accessory": {
          "type": "static_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select a work location",
            "emoji": true
          },
          "options": [
            {
              "text": {
                "type": "plain_text",
                "text": "Client Location",
                "emoji": true
              },
              "value": "Client Location"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "Work from Home",
                "emoji": true
              },
              "value": "Work from Home"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "On-Duty",
                "emoji": true
              },
              "value": "On-Duty"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "Office",
                "emoji": true
              },
              "value": "Office"
            }
          ],
          "action_id": "static_select-action"
        }
      },
    ],
    text: `Hey there <@${message.user}>!`
  });
});

app.action('sign-in', async ({ body, ack, say }) => {
  console.log("🚀 ~ app.action ~ body:", body, userEmail);
  // Acknowledge the action
  await ack();
  await say(`<@${body.user.id}> clicked the button`);
});

app.action('static_select-action', async ({ body, ack, say }) => {
  // console.log("🚀 ~ app.action ~ body:", body)
    await ack();
    // say() sends a message to the channel where the event was triggered
    await say({
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Ready to start your day? Sign In Now."
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Sign In",
              "emoji": true
            },
            "value": `${body.actions[0].selected_option.value}`,
            "action_id": "sign-in"
          }
        }
      ],
    });
  // Acknowledge the action
});

(async () => {
  // Start your app
  await app.start();

  console.log('⚡️ Bolt app is running!');
})();