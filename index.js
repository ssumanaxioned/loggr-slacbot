require('dotenv').config(); // Add this line at the top

const cron = require('node-cron');
const axios = require('axios');
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');

// Create a new instance of the WebClient with your Slack token
const slackClient = new WebClient(process.env.SLACK_TOKEN);
let userEmail = '';
let userId= '';
// Define a function to get the email ID of a user
async function getUserEmail(userId) {
  try {
    // Call the users.info method with the user ID
    const response = await slackClient.users.info({ user: userId });

    // Extract the email ID from the response
    userEmail = response.user.profile.email;
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
app.message('signin', async ({ body, say }) => {
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
    text: `Hey there!`
  });
});

// Listens to incoming messages that contain "hello"
app.message('Signin', async ({ body, say }) => {
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
    text: `Hey there!`
  });
});

app.message('signout', async({ say }) => {
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Hey there :wave: I'm LoggrBot. I'm here to help you sign out of loggr for the day"
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Sign out",
            "emoji": true
          },
          "action_id": "sign-out",
        }
      }
    ],
  })
});
app.message('Signout', async({ say }) => {
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Hey there :wave: I'm LoggrBot. I'm here to help you sign out of loggr for the day"
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Sign out",
            "emoji": true
          },
          "action_id": "sign-out",
        }
      }
    ],
  })
});

app.action('sign-in', async ({ body, ack, say, respond }) => {
  await getUserEmail(body.user.id);
  
  const payload = {
    name: body.user.name,
    email: userEmail,
    location: body.actions[0].value,
    startTime: new Date(),
    status: true
  };

  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const status = await axios.get(`${process.env.SLACK_API_URL}api/attendance`, { params: { email: userEmail } });
    const isDateAvailable = status.data.some(entry => new Date(entry.startTime).toISOString().split('T')[0] === currentDate);

    if (isDateAvailable) {
      await say('You have already signed in for today');
      return;
    } else {
      await axios.post(`${process.env.SLACK_API_URL}api/attendance`, payload);
      await ack();
      await say(`<@${body.user.id}> you have signed in for today. Have a great day ahead!`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
});

app.action('sign-out', async ({ body, ack, say }) => {
  await getUserEmail(body.user.id);
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const status = await axios.get(`${process.env.SLACK_API_URL}api/attendance`, { params: { email: userEmail } });
    const isDateAvailable = status.data.some(entry => new Date(entry.startTime).toISOString().split('T')[0] === currentDate);
    if (isDateAvailable) {
      const payload = {
        id: status.data[status.data.length-1].id,
        endTime: new Date(),
        status: false
      };
      await axios.put(`${process.env.SLACK_API_URL}api/attendance`, payload);
      await ack();
      await say(`<@${body.user.id}> you have signed out for today. Have a great day ahead!`);
    } else {
      await say('You have not signed in for today');
    }
  } catch (error) {
    console.error('Error:', error);
  }
})

app.action('static_select-action', async ({ body, ack, say }) => {
  // Acknowledge the action
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
})();
