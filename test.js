const test = require('supertape')
const { once } = require('events')

const P2Plex = require('./')

test('kitchen sink', async (t) => {
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
