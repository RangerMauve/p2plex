const hyperswarm = require('hyperswarm')
const multiplex = require('multiplex')
const noisePeer = require('noise-peer')
const EventEmitter = require('events')
const pump = require('pump')

module.exports = (opts) => new P2Plex(opts)

class P2Plex extends EventEmitter {
  constructor ({
    keyPair,
    listenSelf = true,
    ...opts
  } = {}) {
    super()
    this.opts = opts
    this.keyPair = keyPair || noisePeer.keygen()
    this.swarm = hyperswarm({
      multiplex: true,
      ...opts
    })

    this.peers = new Set()

    this.swarm.on('connection', (socket, info) => this._handleConnection(socket, info))
    if (listenSelf) this.swarm.join(this.publicKey, { announce: true, lookup: false })
  }

  get publicKey () {
    return this.keyPair.publicKey
  }

  _handleConnection (socket, info) {
    const { client } = info

    const sec = noisePeer(socket, client, {
      pattern: 'XX',
      ...this.opts,
      staticKeyPair: this.keyPair,
      onstatickey: (remoteStaticKey, done) => {
        const publicKey = Buffer.from(remoteStaticKey)
        done()
        const dropped = info.deduplicate(this.publicKey, publicKey)
        if (dropped) return

        const plex = multiplex()

        function disconnect () {
          return new Promise((resolve, reject) => {
            sec.end((err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        }

        const peer = new Peer(publicKey, plex, info, disconnect)

        this.peers.add(peer)

        this.emit('connection', peer)
        info.on('topic', () => this.emit('connection', peer))

        pump(sec, plex, sec, (err) => {
          if (err) peer.emit('error', err)
          this.peers.delete(peer)
          peer.emit('disconnected')
        })
      }
    })
  }

  // Connect to a peer based on their public key
  // Connects to a topic with their public key
  async findByPublicKey (publicKey) {
    return this.findByTopicAndPublicKey(publicKey, publicKey)
  }

  // Find a peer for a given topic with a given public key
  async findByTopicAndPublicKey (topic, publicKey, options = { announce: false, lookup: true }) {
    // Check if we've already connected to this peer
    for (const peer of this.peers) {
      if (peer.publicKey.equals(publicKey) && peer.hasTopic(topic)) return peer
    }

    this.join(publicKey, options)
    const peer = await new Promise((resolve) => {
      const onconnection = (peer) => {
        const { publicKey: remoteKey } = peer

        if (!remoteKey.equals(publicKey)) return
        if (!peer.hasTopic(topic)) return
        this.removeListener('connection', onconnection)
        resolve(peer)
      }

      this.on('connection', onconnection)
    })

    await this.leave(publicKey)

    return peer
  }

  async join (topic, options) {
    return new Promise((resolve) => {
      this.swarm.join(topic, options, resolve)
    })
  }

  async leave (topic) {
    return new Promise((resolve) => {
      this.swarm.leave(topic, resolve)
    })
  }

  async destroy () {
    const allPeers = [...this.peers]
    await Promise.all(allPeers.map((peer) => {
      return peer.disconnect()
    }))

    return new Promise((resolve, reject) => {
      this.swarm.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

class Peer extends EventEmitter {
  constructor (publicKey, plex, info, disconnect) {
    super()
    this.publicKey = publicKey
    this.plex = plex
    this.info = info
    this.incoming = !info.client
    this.disconnect = disconnect

    plex.on('stream', (stream, id) => this.emit('stream', stream, id))
    plex.on('error', (err) => this.emit('error', err))

    this.info.on('topic', (topic) => this.emit('topic', topic))

    process.nextTick(() => {
      for (const topic of this.topics) {
        this.emit('topic', topic)
      }
    })
  }

  get topics () {
    if (this.info.topics) return this.info.topics
    if (this.info.peer && this.info.peer.topic) return this.info.peer.topic
    return []
  }

  hasTopic (topic) {
    for (const existing of this.topics) {
      if (existing.equals(topic)) return true
    }
    return false
  }

  createStream (...args) {
    return this.plex.createStream(...args)
  }

  receiveStream (...args) {
    return this.plex.receiveStream(...args)
  }

  createSharedStream (...args) {
    return this.plex.createSharedStream(...args)
  }

  ban () {
    this.info.ban()
  }

  backoff () {
    this.info.backoff()
  }
}
