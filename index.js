const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const axios = require('axios')
const { Sticker, StickerTypes } = require('wa-sticker-formatter')

const GROQ_KEY = process.env.GROQ_API_KEY

async function aiBryan(text) {
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Ngana adalah Bot Bryan, teman nongkrong dari Manado. Ngomong pake logat Manado, santai, lucu, pake kata wey, bro, gas, ngana, torang, kwa. Jawab singkat padat, jangan kaku.' },
        { role: 'user', content: text }
      ],
      temperature: 0.8
    }, { headers: { Authorization: `Bearer ${GROQ_KEY}` } })
    return res.data.choices[0].message.content
  } catch (e) { return 'Waduh bro, otak gue lagi blank. Coba tanya lagi kwa!' }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: true })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'close') {
      const shouldReconnect = (u.lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) start()
    } else if (u.connection === 'open') console.log('BOT BRYAN NYALA 🔥')
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ''
    if (!body.startsWith('!')) {
      if (!from.includes('@g.us')) {
        const reply = await aiBryan(body)
        await sock.sendMessage(from, { text: reply }, { quoted: m })
      }
      return
    }

    const [cmd, ...args] = body.slice(1).split(' ')
    const q = args.join(' ')

    if (cmd === 'ai') {
      await sock.sendMessage(from, { text: await aiBryan(q) }, { quoted: m })
    }
    if (cmd === 'menu') {
      await sock.sendMessage(from, { text: '🔥 *BOT BRYAN* 🔥\n\n!ai <tanya> - ngobrol dgn Bot Bryan\n!stiker - kirim foto + caption !stiker\n!tiktok <link> - download TikTok\n!ig <link> - download IG\n!ytmp3 <link> - download lagu YT\n\nGas bro!' }, { quoted: m })
    }
    if (cmd === 'stiker') {
      try {
        const buffer = await downloadMediaMessage(m, 'buffer', {})
        const sticker = new Sticker(buffer, { pack: 'Bot Bryan', author: 'Bryan', type: StickerTypes.FULL, quality: 50 })
        await sock.sendMessage(from, await sticker.toMessage(), { quoted: m })
      } catch { await sock.sendMessage(from, { text: 'Kirim foto + caption !stiker bro!' }, { quoted: m }) }
    }
    if (cmd === 'tiktok' || cmd === 'ig' || cmd === 'ytmp3') {
      await sock.sendMessage(from, { text: 'Sabar bro, gue download dulu...' }, { quoted: m })
      try {
        const api = cmd === 'tiktok' ? `https://www.tikwm.com/api/?url=${q}` : `https://api.davidcyriltech.my.id/download/${cmd}?url=${encodeURIComponent(q)}`
        const r = await axios.get(api)
        const url = r.data?.data?.play || r.data?.result?.url || r.data?.data?.video
        if (url) await sock.sendMessage(from, { video: { url }, caption: 'Nih bro, hasil download Bot Bryan 🔥' }, { quoted: m })
        else await sock.sendMessage(from, { text: 'Gagal download bro, link-nya salah kwa?' }, { quoted: m })
      } catch { await sock.sendMessage(from, { text: 'Gagal bro, coba link lain.' }, { quoted: m }) }
    }
  })
}
start()
