# NodeRGB-Server

A node.js server application that uses a websocket and a UDP connection to serve as an interface between a web browser and [NodeRGB](https://github.com/cedrichaase/nodergb)

The application opens a websocket at `ws://localhost:3000` and accepts data in the format of
```typescript
interface ColorData {
  device: string,
  color: string
}
```
It then resolves the device ID to the device's IP address using `config/devices.json` and sends the color to it via a UDP datagram.