const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'
const garmentCategory = process.argv[2] || 'tops'

const payload = {
  personImageUrl:
    'https://i.pinimg.com/736x/87/1a/bd/871abd7f0372f43e3e0b024ec1ffe219.jpg',
  garmentImageUrl:
    'https://i.pinimg.com/736x/60/b8/6f/60b86f572fcb8af3d60c348449e41a68.jpg',
  garmentCategory,
  requestId: `vto-script-${Date.now()}`,
}

async function main() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 210000)

  console.log('[test-vto] Sending request to AI server', {
    url: `${AI_SERVER_URL}/virtual-try-on`,
    payload,
  })

  try {
    const response = await fetch(`${AI_SERVER_URL}/virtual-try-on`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const rawText = await response.text()
    let parsed

    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = rawText
    }

    if (!response.ok) {
      console.error('[test-vto] Request failed', {
        status: response.status,
        body: parsed,
      })
      process.exitCode = 1
      return
    }

    console.log('[test-vto] Request succeeded')
    console.log(JSON.stringify(parsed, null, 2))
  } catch (error) {
    console.error('[test-vto] Unexpected error', {
      message: error.message,
      name: error.name,
    })
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
  }
}

main()
