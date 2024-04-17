const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })
const userMessages = {} // دیکشنری برای ذخیره متن پیام هر کاربر

async function checkPublicChannelMembership (userId)
{
    const channel1Id = -1001956864682
    const channel2Id = -1002111615139

    try
    {
        const [channel1Membership, channel2Membership] = await Promise.all([
            bot.getChatMember(channel1Id, userId),
            bot.getChatMember(channel2Id, userId)
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

let showMembershipPrompt = true
const startedUsers = [] // آرایه برای ذخیره آی دی کاربرانی که استارت زده‌اند

bot.onText(/^\/start$/, (msg) =>
{
    const chatId = msg.chat.id
    const userId = msg.from.id

    // بررسی آیا کاربر قبلاً استارت زده یا نه
    if (startedUsers.includes(userId))
    {
        // اگر قبلاً استارت زده بود، پیام مناسب را ارسال کنید
        bot.sendMessage(chatId, 'شما قبلاً استارت زده‌اید!')
        return
    }

    // اضافه کردن آی دی کاربر به آرایه کاربرانی که استارت زده‌اند
    startedUsers.push(userId)

    // اجرای دستور استارت برای کاربر
    handleStart(msg, chatId)
})


function handleStart (msg, chatId)
{
    const userId = msg.from.id

    if (msg.text.trim() === '/help')
    {
        handleHelp(chatId)
        return
    }

    checkPublicChannelMembership(userId)
        .then((membership) =>
        {
            const keyboard = { inline_keyboard: [] }

            if (!membership.channel1)
                keyboard.inline_keyboard.push([{ text: 'عضویت در کانال اول ما 1️⃣', url: 'https://t.me/DeepDevs' }])

            if (!membership.channel2)
                keyboard.inline_keyboard.push([{ text: 'عضویت در کانال دوم ما 2️⃣', url: 'https://t.me/InstaDevs' }])

            if (keyboard.inline_keyboard.length > 0)
            {
                keyboard.inline_keyboard.push([{ text: '👉 Use Bot 👈', callback_data: 'use_bot' }])
                if (showMembershipPrompt)
                {
                    bot.sendMessage(chatId, 'این کانالها مربوط به برنامه نویسی هست و ماله خودمونه 👨‍💻\nاگر میخوای از ربات استفاده کنی داخل این کانالها عضو شو 🙏\nبعد ازعضویت روی Use Bot کلیک کن و تمام 💪', { reply_markup: JSON.stringify(keyboard) })
                    showMembershipPrompt = false
                }
            } else
            {
                sendInstructions(chatId)
            }
        })
        .catch((error) =>
        {
            console.error('Error checking memberships:', error)
            bot.sendMessage(chatId, 'An error occurred while checking channel memberships. Please try again later.')
        })
}


let helpRequested = false
bot.onText(/^\/help$/i, (msg) =>
{
    const chatId = msg.chat.id
    const userId = msg.from.id

    // فقط اگر کاربر قبلاً استارت رو زده بود، پاسخ دهید
    if (startedUsers.includes(userId))
    {
        handleHelp(chatId)
    } else
    {
        console.log("User didn't start yet.")
        bot.sendMessage(chatId, 'برای استفاده از ربات، لطفاً دستور /start را ارسال کنید.')
            .catch((error) =>
            {
                console.error('Error sending message to user:', error)
            })
    }
})


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


bot.on('callback_query', (query) =>
{
    const chatId = query.message.chat.id
    const data = query.data

    if (data === 'use_bot')
    {
        const userId = query.from.id

        checkPublicChannelMembership(userId)
            .then((membership) =>
            {
                if (membership.channel1 && membership.channel2)
                {
                    sendInstructions(chatId)
                } else
                {
                    let message = 'کانالهای ما مربوط به برنامه نویسه و ماله خودمون هست 👨‍💻\n\nاگر میخوای از ربات استفاده کنی داخل کانالهامون عضو شو 🙏\n\nبعد ازعضویت روی use bot کلیک کن و تمام 💪\n\n'
                    if (!membership.channel1) message += '😝 به کانال اول ما هنوز عضو نشدی  😝\n'
                    if (!membership.channel2) message += '😝 به کانال دوم ما هنوز عضو نشدی  😝\n'

                    if (message.trim() !== '') bot.sendMessage(chatId, message)
                    else console.error('Empty message')
                }
            })
            .catch((error) =>
            {
                console.error('Error checking memberships:', error)
                bot.sendMessage(chatId, 'An error occurred while checking channel memberships. Please try again later.')
            })
    } else
    {
        handleMarkdownQuery(query)
    }
})

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

    // استفاده از دیکشنری userMessages برای متن مورد نظر کاربر
    const temporaryText = userMessages[chatId] || ''

    if (data === 'new_text')
    {
        sendInstructions(chatId) // ارسال دستور برای وارد کردن متن جدید
        return
    }

    // اگر کاربر بجای انتخاب متن جدید، دوباره از گزینه‌های مارک‌داون موجود استفاده کند، به او یک یادآوری ارسال شود
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
}
bot.onText(/^\/start_new_text$/, (msg) =>
{
    const chatId = msg.chat.id
    sendInstructions(chatId)
})


function sendInstructions (chatId)
{
    userMessages[chatId] = '' // انتخاب یک متغیر مجزا برای هر کاربر
    bot.sendMessage(chatId, 'متن مورد نظرت رو بنویس تا من برات قالب های Markdown رو نشون بدم ✍️')
        .then(() =>
        {
            bot.once('message', (msg) =>
            {
                if (msg.text.trim() === '/help')
                {
                    handleHelp(chatId)
                } else if (msg.text.trim() === '')
                {
                    // اگر پیام متنی نبود ولی شامل عکس یا سند بود
                    if (msg.photo !== undefined || msg.document !== undefined)
                    {
                        // به کاربر اخطار داده شود
                        bot.sendMessage(chatId, 'فقط می‌توانید متن ارسال کنید.')
                    } else
                    {
                        // اگر پیام متنی نبود و همچنین شامل عکس یا سند نبود، به کاربر پیام خطایی داده شود
                        bot.sendMessage(chatId, 'خطای نامشخص رخ داده است. لطفاً دوباره تلاش کنید.')
                    }
                } else
                {
                    userMessages[chatId] = msg.text // ذخیره متن پیام کاربر در دیکشنری userMessages
                    sendMarkdownOptions(chatId)
                }
            })
        })
}

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

function sendLinkPrompt (chatId)
{
    bot.sendMessage(chatId, '🔗 آدرس URL ات رو وارد کن 🔗')
    bot.once('message', (msg) =>
    {
        const url = msg.text
        const formattedText = `[${userMessages[chatId]}](${url})` // استفاده از userMessages برای متن مورد نظر کاربر
        bot.sendMessage(chatId, formattedText)
    })
}