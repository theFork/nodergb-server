import {ConfigService} from "./src/service/config.service";
import {RgbClient} from "./src/client/rgb.client";
import * as express from 'express';
const dgram = require('dgram');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

/**
 * Interface for color data received via websocket
 */
interface ColorData {
    color: string,
    device: string
}

const config = new ConfigService();
const rgb = new RgbClient(1337, config);

let lastColor = {};
for (const device of config.getDevices()) {
    lastColor[device.id] = 'fff';
}

/* region REST */

/**
 * enable CORS
 */
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

/**
 * GET list of IDs of managed devices
 */
app.get('/devices', (req: express.Request, res: express.Response) => {
    let devices = config.getDevices();

    devices = devices.map(device => {
        device['color'] = `#${lastColor[device.id]}`;
        return device;
    });

    res.status(200);
    res.send(devices);
});

/* endregion REST */

/* region websocket */

io.on('connection', function(socket){
    console.log('a client connected');

    socket.on('disconnect', function(){
        console.log('client disconnected');
    });

    /**
     * handle color data
     */
    socket.on('set-color', (data: ColorData) => {
        // extract the data as required by UDP interface
        let hostdata = data.device.split('.');

        const host = hostdata.shift();

        let new_hostdata = hostdata.join('.');


        const address = config.getIpForDeviceId(host);
        const color = `${data.color}\n`;

        // send the data via UDP
        rgb.setColor(address, color, new_hostdata);
    });
});

/* endregion websocket */

http.listen(3000, function () {
    console.log('nodergb server listening on port 3000!');
});


/* region udp-server */

const udp = dgram.createSocket('udp4');

udp.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    udp.close();
});

udp.on('message', (message, rinfo) => {
    message = String(message).split(':');
    const color = message.pop();

    let hostdata = message.pop();
    if (hostdata) {
        hostdata = hostdata.split('.');
        const host = hostdata.shift();
        hostdata = hostdata.join('.');

        rgb.setColorById(host, color, hostdata);

        return;
    }

    rgb.broadcastColor(color);
});

udp.on('listening', () => {
    let address = udp.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

udp.bind(1337);

/* endregion udp-server */


/* region discovery */


const udpDiscoverRecv = dgram.createSocket('udp4');

udpDiscoverRecv.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    udpDiscoverRecv.close();
});

udpDiscoverRecv.on('message', (message, rinfo) => {
    message = message.toString().trim();

    console.log(`Received discover response: ${message}`);
});

udpDiscoverRecv.on('listening', () => {
    let address = udpDiscoverRecv.address();
    console.log(`server listening ${address.address}:${address.port}`);



    // send hello to broadcast
    const udpDiscoverSend = dgram.createSocket('udp4');

    udpDiscoverSend.on('listening', () => {
        udpDiscoverSend.setBroadcast(true);

        const port = 1341;
        const msg = 'hello';

        udpDiscoverSend.send(Buffer.from(msg), port, '255.255.255.255', (err) => {
            console.log(`sent broadcast to port ${port}`);
        });
    });
    udpDiscoverSend.bind();

});

udpDiscoverRecv.bind(1340);

/* endregion discovery */