require('dotenv').config(); // Add this line at the top

const cron = require('node-cron');
const axios = require('axios');
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');

// Create a new instance of the WebClient with your Slack token
const slackClient = new WebClient(process.env.SLACK_TOKEN);
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
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
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

app.event('user_presence_change', async ({ event, say }) => {
  if (event.presence === 'active') {
    console.log("🚀 ~ app.event ~ event:", event)

    await getUserEmail(event.user);
    // say() sends a message to the channel where the event was triggered
    await say({
      "type": "home",
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
  }
});

app.action('sign-in', async ({ body, ack, say, respond }) => {
  console.log("🚀 ~ app.action ~ body:", body);
  // Acknowledge the action
  const payload = {
    name: body.user.name,
    email: userEmail,
    location: body.actions[0].value,
    startTime: new Date(),
    status: true
  };
  console.log("🚀 ~ app.action ~ payload:", payload)

  try {
    await axios.post(`${process.env.SLACK_API_URL}api/attendance`, payload);
  } catch (error) {
    console.error('Error:', error);
  }
  await ack();
  await say(`<@${body.user.id}> clicked the button`);


  // Update the message block to remove or disable the button
  const updatedBlocks = body.message.blocks.map(block => {
    if (block.accessory && block.accessory.action_id === 'sign-in') {
      console.log("🚀 ~ updatedBlocks ~ block.accessory:", block.accessory)
      return {
        ...block,
        accessory: {
          ...block.accessory,
          disabled: true // Set disabled to true to disable the button
        }
      };
    }
    return block;
  });
  console.log("🚀 ~ updatedBlocks ~ updatedBlocks:", updatedBlocks)

  await say({
    replace_original: true,
    blocks: updatedBlocks,
  });
});

app.action('static_select-action', async ({ body, ack, say }) => {
  // console.log("🚀 ~ app.action ~ body:", body)
  await ack();
  // say() sends a message to the channel where the event was triggered
  await say({
    replace_original: true,
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
          "action_id": "sign-in",
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


// Define the schedule for the message
const schedule = '29 20 * * *'; // Every day at 8:07 PM

// Define the message to be sent
const message = 'Hello from your Slack bot!';

// Schedule the message
cron.schedule(schedule, async () => {
  try {
    // Send the message to a specific channel
    const result = await slackClient.chat.postMessage({
      
      text: message,
    })
    console.log('Message sent:', result.ts);
  } catch (error) {
    console.error('Error sending message:', error);
  }
});