# p2plex
Multiplex encrypted connections to peers over a p2p network.

```shell
npm i -s p2plex
```

```js
const p2plex = require('p2plex')

const plex1 = p2plex()
const plex2 = p2plex()

plex1.on('connection', (peer) => {
	peer.receiveStream('example').on('data', (data) => {
		console.log('Got data from', peer.publicKey, ':', data.toString('utf8'))
		plex1.destroy()
		plex2.destroy()
	})
})

plex2.findByPublicKey(plex1.publicKey).then((peer) => {
	peer.createStream('example').end('Hello World!')
})
```

## How it works

This module combines [Hyperswarm](https://github.com/hyperswarm/hyperswarm) for P2P networking, [Noise-peer](https://github.com/emilbayes/noise-peer) for encrypted communication, and [Multiplex](https://www.npmjs.com/package/multiplex) for sending multiple streams over a single connection.
The deduplication happens under the hood. Your application should focus on opening and closing streams on peers and not worry about whether the peer has just connected or it was connected already.
Once all the multiplexed streams for a peer end, the connection will be dropped automatically.

## API

### `const plex = p2plex({keyPair, listenSelf, ...opts})`

Initialize a new p2plex instance.

- `keyPair`: is a public/private key pair for transport encryption / authentication. If you don't specify one, it will be auto-generated.
- `listenSelf`: This controls whether you'll start advertising yourself for people to find you with `findByPublicKey`. `true` by default.
- `opts`: These options get passed down to `hyperswarm` and `noise-peer`. This gives you more control over those modules if you know what you're doing.

### `plex.publicKey`

This is a Buffer object containing your public key. Your application can use this as your identity in the swarm and can be exchanged with peers to enable connecting to you later.

### `plex.keyPair`

This is an object containing your key pair with the `publicKey` and `secretKey`. You might want to save this for later if you want a persistant identity.

### `plex.peers`

This is a Set of all the currently connected peers.

### `plex.swarm`

This is the raw hyperswarm instance. You probably shouldn't mess with it unless you really know what you're doing.

### `plex.on('connection', (peer) => {})`

This event gets emitted every time a new peer gets connected.

- `peer`: is a `Peer` object representing the connection to someone in the network.

### `const peer = await plex.findByPublicKey(publicKey)`

This method will attempt to discover a peer with the given public key on the network.
You should probably wrap this in a timeout. PRs for introducing cancellation would be appreciated.

- `publicKey` is a Buffer containing the other peers' public key.
- `peer`: is a `Peer` object representing the connection to someone in the network.

### `const peer = await plex.findByTopicAndPublicKey(topic, publicKey,  {announce: false, lookup: true})`

This method will attempt to discover a peer under a given topic with a given public key.
If you don't specify the announce and lookup options, the defaults will be used.
You should probably wrap this in a timeout. PRs for introducing cancellation would be appreciated.
**Note:** There's currently a bug where the deduplication logic ends up emitting errors. To mitigate this, have one side set `announce:true,lookup:false` and the other side set `announce:false,lookup:true`.


- `topic` should be a 32 byte Buffer which is the key you want to use to find other peers.
- `publicKey` is a Buffer containing the other peers' public key.
- `announce` sets whether you will be announcing your existance for this key to get incoming peer connections.
- `lookup` Sets whether you will be actively searching for peers on the network and making outgoing connections. 
- `peer`: is a `Peer` object representing the connection to someone in the network.

### `await plex.join(topic, {announce: false, lookup: true})`

Starts finding peers on the network.
Resolves once a full lookup has been completed.
You usually don't need to await this promise and keep going while it does stuff in the background.

- `topic` should be a 32 byte Buffer which is the key you want to use to find other peers.
- `announce` sets whether you will be announcing your existance for this key to get incoming peer connections.
- `lookup` Sets whether you will be actively searching for peers on the network and making outgoing connections. 

### `await plex.leave(topic)`

Stops finding peers on the network and removes all trace of itself from the p2p network for this key.

- `topic` should be a 32 byte Buffer which is the key you want to use to find other peers.

### `await plex.destroy()`

Gracefully disconnects from all peers, removes itself from the p2p network, and shuts down the p2p network instance.

### `peer.publicKey`

Every peer will have their public key populated so that you can verify their identity or save it for use later.

### `peer.incoming`

A boolean representing whether this peer represents an incoming connection or an outgoing connection.

### `peer.topics`

This is an array of topic names that this peer has been discovered for on the network. Might be empty for incomming connections.

### `peer.on('topic', (topic) => {})`

This gets emitted when a topic has been associated with a peer.
This gets emitted when peer initially connects, and then whenever the swarm discovers them advertising on another topic after already connecting.

### `peer.on('stream', (stream, id) => {})`

This gets emitted when the peer gets a new stream over the multiplex connections.

- `stream` Is a [node-style Duplex stream](https://nodejs.org/api/stream.html) you can read and write from.
- `id` is a String representing the name given to the stream when it was being created.

### `peer.on('disconnected', () => {})

This gets emitted when the peer's connection has been severed at the network level.

### `peer.on('error', (err) => {})`

This gets emitted when there is an error either in the connection or the multiplex module

### `const stream = peer.createStream(id)`

Create a stream over the multiplexer. The other side should use `peer.receiveStream(id)` to get the stream.

- `id` is a string which identifies the stream on both sides.

### `const stream = peer.receiveStream(id)`

Recieves a stream over the multiplexer. The other side should use `peer.createStream(id)` to get the stream.

### `const stream = peer.createSharedStream(id)`

Create a shared stream over the multiplexer. If both sides create a shared stream with the same id, data from one end will go to the other.

### `peer.ban()`

Tell the swarm to avoid connecting to this peer in the future. This can be useful if there's misbehaving peers or giving users more control.

### `await peer.disconnect()`

Gracefully disconnects from the peer and resolves once the disconnection is complete.

## Credits

Big thanks to [playproject.io](https://playproject.io/) for sponsoring this work for use in the [DatDot](https://playproject.io/datdot-service/) project.
