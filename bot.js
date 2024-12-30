const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();


// Replace with your Telegram Bot's API token
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Replace with your channel username (without @)
const channelUsername = '';

let questions = [];

// Command to start the bot
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome! Type /sendquiz to start sending daily quiz questions.');
});

// Command to upload and set the new questions JSON
bot.onText(/\/setquestions/, (msg) => {
    const chatId = msg.chat.id;

    // Request to upload the JSON file
    bot.sendMessage(chatId, 'Please upload a JSON file with the quiz questions.');
});

// Handle the uploaded file and save the questions
bot.on('document', (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;

    bot.getFileLink(fileId).then((fileLink) => {
        const fileUrl = fileLink;

        // Download the JSON file from the Telegram server
        const https = require('https');
        const filePath = path.join(__dirname, 'questions.json');
        const file = fs.createWriteStream(filePath);

        https.get(fileUrl, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    bot.sendMessage(chatId, 'JSON file uploaded successfully. The quiz will start now.');
                    loadQuestions();
                });
            });
        });
    });
});

// Load the questions from the uploaded JSON
const loadQuestions = () => {
    try {
        const data = fs.readFileSync('questions.json');
        questions = JSON.parse(data);
    } catch (error) {
        console.error('Error loading questions:', error);
    }
};

// Command to start sending quiz questions to the channel
bot.onText(/\/sendquiz/, (msg) => {
    const chatId = msg.chat.id;

    if (questions.length === 0) {
        bot.sendMessage(chatId, 'No questions loaded. Please upload a valid JSON file using /setquestions.');
        return;
    }

    bot.sendMessage(chatId, 'Starting the daily quiz!');

    // Start sending the quiz questions to the channel
    sendQuizToChannel(0);
});

// Function to send quiz questions to the channel
const sendQuizToChannel = (index) => {
    if (index >= questions.length) {
        console.log("All questions have been sent for today.");
        return;
    }

    const question = questions[index];
    const options = question.options;
    const correctOptionId = options.indexOf(question.correct_answer);

    // Validate the correct option ID
    if (correctOptionId < 0 || correctOptionId >= options.length) {
        console.error(`Error: Invalid correct answer for question: "${question.question}"`);
        setTimeout(() => sendQuizToChannel(index + 1), 10000); // Skip to the next question
        return;
    }

    bot.sendPoll(channelUsername, question.question, options, {
        is_anonymous: true, // Make the poll anonymous
        type: "quiz",
        correct_option_id: correctOptionId,
    })
    .then(() => {
        setTimeout(() => sendQuizToChannel(index + 1), 10000); // Send every 10 seconds
    })
    .catch((err) => {
        console.error("Error sending poll:", err);
    });
};



// Run the bot
bot.on('polling_error', (error) => {
    console.log(error);
});

// Start by loading questions from file (if exists)
loadQuestions();