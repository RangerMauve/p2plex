const test = require('supertape')
const { once } = require('events')
const crypto = require('crypto')

const P2Plex = require('./')

test('Find by public key and send data', async (t) => {
  const p1 = P2Plex()
  const p2 = P2Plex()

  const [[peer1], peer2] = await Promise.all([
    once(p1, 'connection'),
    p2.findByPublicKey(p1.publicKey)
  ])

  t.pass('Got peers')

  const stream1 = peer1.receiveStream('example')
  const stream2 = peer2.createStream('example')

  t.pass('Got streams')

  const toWrite = Buffer.from('Hello World')
  process.nextTick(() => {
    stream2.write(toWrite)
  })
  const [data] = await once(stream1, 'data')

  t.deepEquals(data, toWrite, 'Got data')

  await Promise.all([
    p1.destroy(),
    p2.destroy()
  ])

  t.pass('Destroyed swarm')

  t.end()
})

test('Find by public key and send data', async (t) => {
  const p1 = P2Plex()
  const p2 = P2Plex()

  const topic = crypto.randomBytes(32)

  const [peer1, peer2] = await Promise.all([
    p1.findByTopicAndPublicKey(topic, p2.publicKey, { announce: true, lookup: false }),
    p2.findByTopicAndPublicKey(topic, p1.publicKey, { lookup: true, announce: false })
  ])

  t.pass('Got peers')

  const stream1 = peer1.receiveStream('example')
  const stream2 = peer2.createStream('example')

  t.pass('Got streams')

  const toWrite = Buffer.from('Hello World')
  process.nextTick(() => {
    stream2.write(toWrite)
  })
  const [data] = await once(stream1, 'data')

  t.deepEquals(data, toWrite, 'Got data')

  await Promise.all([
    p1.destroy(),
    p2.destroy()
  ])

  t.pass('Destroyed swarm')

  t.end()
})
