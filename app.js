const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
require('dotenv').config()

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })
const userMessagesFile = 'userMessages.json'
let startedUsers = []
let helpRequested = false

let userMessages = {}

// بررسی وجود فایل و لود اطلاعات
if (fs.existsSync(userMessagesFile))
{
    const data = fs.readFileSync(userMessagesFile)
    userMessages = JSON.parse(data)
}

// ذخیره سازی پیام کاربر در فایل
function saveUserMessage (userId, message)
{
    // استفاده از مقدار واقعی دکمه‌های مارک‌داون برای ذخیره در فایل JSON
    if (message.startsWith('/'))
    {
        // اگر پیام یک دستور است، آن را به صورت یک دیکشنری با کلید "command" ذخیره کنید
        userMessages[userId] = { command: message, markdownOption: '' }
    } else
    {
        // در غیر این صورت، پیام متنی است و به عنوان "message" ذخیره شود
        userMessages[userId] = { message: message, markdownOption: '' }
    }
    fs.writeFileSync(userMessagesFile, JSON.stringify(userMessages))
}



// حذف پیام کاربر از فایل
function deleteUserMessage (userId)
{
    delete userMessages[userId]
    fs.writeFileSync(userMessagesFile, JSON.stringify(userMessages))
}

async function checkPublicChannelMembership (userId)
{
    const channel1Id = -1001956864682
    const channel2Id = -1002111615139

    try
    {
        const [channel1Membership, channel2Membership] = await Promise.all([
            bot.getChatMember(channel1Id, userId),
            bot.getChatMember(channel2Id, userId),
        ])

        const isMember1 = channel1Membership.status !== 'left' && channel1Membership.status !== 'kicked'
        const isMember2 = channel2Membership.status !== 'left' && channel2Membership.status !== 'kicked'

        return { channel1: isMember1, channel2: isMember2 }
    } catch (error)
    {
        console.error('Error checking channel memberships:', error)
        return { channel1: false, channel2: false }
    }
}

bot.onText(/^\/start_new_text$/, (msg) =>
{
    const chatId = msg.chat.id
    if (!startedUsers.includes(chatId))
    {
        startedUsers.push(chatId)
        userMessages[chatId] = { message: '', markdownOption: '' }
        sendInstructions(chatId)
    }
});

bot.onText(/^\/help$/, (msg) =>
{
    const chatId = msg.chat.id
    handleHelp(chatId)
})

bot.onText(/^\/start$/, (msg) =>
{
    const chatId = msg.chat.id
    sendInstructions(chatId)
})


function sendInstructions (chatId)
{
    bot.sendMessage(chatId, 'متن مورد نظرت رو بنویس تا من برات قالب های Markdown رو نشون بدم ✍️').then(() =>
    {
        bot.once('message', (msg) =>
        {
            if (msg.chat.id === chatId)
            {
                if (msg.text.trim() === '/help')
                {
                    handleHelp(chatId)
                } else if (msg.text.trim() === '')
                {
                    if (msg.photo !== undefined || msg.document !== undefined)
                    {
                        bot.sendMessage(chatId, 'فقط می‌توانید متن ارسال کنید.')
                    } else
                    {
                        bot.sendMessage(chatId, 'خطای نامشخص رخ داده است. لطفاً دوباره تلاش کنید.')
                    }
                } else
                {
                    userMessages[chatId].message = msg.text
                    sendMarkdownOptions(chatId)
                }
            }
        })
    })
}



// Function to send markdown options
function sendMarkdownOptions (chatId)
{
    const userId = chatId

    checkPublicChannelMembership(userId)
        .then((membership) =>
        {
            if (membership.channel1 && membership.channel2)
            {
                bot.sendMessage(chatId, 'فرمت Markdown ات رو انتخاب کن', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'bold', callback_data: 'bold' },
                                { text: 'italic', callback_data: 'italic' },
                                { text: 'link', callback_data: 'link' },
                                { text: 'code', callback_data: 'code' },
                            ],
                            [
                                { text: 'item list', callback_data: 'item list' },
                                { text: 'quote', callback_data: 'quote' },
                                { text: 'strikethrough', callback_data: 'strikethrough' },
                            ],
                            [
                                { text: 'Header 1', callback_data: 'header_1' },
                                { text: 'Header 2', callback_data: 'header_2' },
                                { text: 'Header 3', callback_data: 'header_3' },
                                { text: 'Header 4', callback_data: 'header_4' },
                            ],
                            [{ text: '📝 متن جدیدت رو بنویس 📝', callback_data: 'new_text' }],
                        ],
                    },
                })
            } else
            {
                let keyboard = []
                if (!membership.channel1)
                {
                    keyboard.push([{ text: 'عضویت در کانال اول ما 1️⃣', url: 'https://t.me/DeepDevs' }])
                }
                if (!membership.channel2)
                {
                    keyboard.push([{ text: 'عضویت در کانال دوم ما 2️⃣', url: 'https://t.me/InstaDevs' }])
                }
                if (keyboard.length > 0)
                {
                    keyboard.push([{ text: '👉 Use Bot 👈', callback_data: 'use_bot' }])
                    bot.sendMessage(chatId, 'برای استفاده از این قابلیت، لطفاً در کانال‌های زیر عضو شوید ✔️', {
                        reply_markup: {
                            inline_keyboard: keyboard,
                        },
                    })
                }
            }
        })
        .catch((error) =>
        {
            console.error('Error checking memberships:', error)
            bot.sendMessage(chatId, 'An error occurred while checking channel memberships. Please try again later.')
        })
}

bot.on('message', (msg) =>
{
    const chatId = msg.chat.id
    saveUserMessage(chatId, msg.text)
})

// Callback query handling
bot.on('callback_query', (query) =>
{
    const chatId = query.message.chat.id
    const data = query.data

    if (data === 'use_bot')
    {
        sendInstructions(chatId)
    } else
    {
        // Save the selected markdown option for the user
        userMessages[chatId].markdownOption = data
        handleMarkdownQuery(query)
    }
});


function handleMarkdownQuery (query)
{
    const chatId = query.message.chat.id
    const data = query.data
    let formattedText = ''

    if (data === '/help')
    {
        handleHelp(chatId)
        return
    }

    const temporaryText = userMessages[chatId] ? userMessages[chatId].message : ''

    if (data === 'new_text')
    {
        sendInstructions(chatId)
        return
    }

    if (temporaryText === '' && data !== 'new_text')
    {
        bot.sendMessage(chatId, 'متن جدیدت رو وارد نکردی هنوز ✍️').catch(console.error)
        return
    }

    switch (data)
    {
        case 'bold':
            formattedText = `**${temporaryText}**`
            break
        case 'italic':
            formattedText = `_${temporaryText}_`
            break
        case 'code':
            formattedText = `\`${temporaryText}\``
            break
        case 'link':
            sendLinkPrompt(chatId)
            return
        case 'header_1':
        case 'header_2':
        case 'header_3':
        case 'header_4':
            const level = parseInt(data.split('_')[1])
            formattedText = `${'#'.repeat(level)} ${temporaryText}`
            break
        case 'inline_code':
            formattedText = `\`${temporaryText}\``
            break
        case 'strikethrough':
            formattedText = `~~${temporaryText}~~`
            break
        case 'quote':
            formattedText = `> ${temporaryText}`
            break
        case 'item list':
            formattedText = `- ${temporaryText}`
            break
    }

    if (formattedText.trim() !== '')
    {
        bot.sendMessage(chatId, formattedText)
    }

    // Update userMessages JSON file with the latest markdown option
    fs.writeFileSync(userMessagesFile, JSON.stringify(userMessages))
}

function sendLinkPrompt (chatId)
{
    bot.sendMessage(chatId, '🔗 آدرس URL ات رو وارد کن 🔗').then(() =>
    {
        bot.once('message', (msg) =>
        {
            const url = msg.text.trim() // دریافت آدرس URL از پیام
            const temporaryText = userMessages[chatId].message // متن مورد نظر کاربر
            const formattedText = `[${temporaryText}](${url})` // ساخت متن لینک
            bot.sendMessage(chatId, formattedText) // ارسال متن لینک به کاربر
            // Update userMessages JSON file with the latest markdown option
            userMessages[chatId].markdownOption = 'link'
            fs.writeFileSync(userMessagesFile, JSON.stringify(userMessages))
        })
    })
}




function handleHelp (chatId)
{
    if (helpRequested)
    {
        return
    }
    helpRequested = true
    const helpMessage = `
    به مرکز راهنمایی ربات Markdown خوش آمدید:

    /start_new_text -  ♻️ متن جدیدت رو بنویس ♻️
    /help -  🆘 دسترسی به بخش راهنمایی 🆘

⚠️در این عکس تمام سینتکس های مربوط به فرمت Markdown به صورت مثالی نوشته شده است ⚠️
    `
    bot.sendMessage(chatId, helpMessage)
        .then(() =>
        {
            const url = 'https://ibb.co/7Qx87YN'
            bot.sendPhoto(chatId, url)
            setTimeout(() =>
            {
                helpRequested = false
            }, 1000)
        })
        .catch((error) => console.error('Error sending help message:', error))

    const userId = chatId
    // چک کردن آیا کاربر استارت زده یا نه
    if (!startedUsers.includes(userId))
    {
        bot.sendMessage(chatId, 'برای شروع از دستور /start استفاده کنید.')
    }
}

