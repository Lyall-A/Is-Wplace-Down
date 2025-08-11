const config = require('./config.json');

let status = null; // 0 = down, 1 = up
let stateChangedSinceStart = false;
let lastStatusChange = null;
let lastHealth = null;

(async function checkStatusInterval() {
    await checkStatus();
    setTimeout(checkStatusInterval, config.checkInterval);
})();

async function checkStatus() {
    await fetch('https://backend.wplace.live/health').then(res => {
        const isUp = res.status === 200;
        const statusChanged = status === null || (isUp && status === 0) || (!isUp && status === 1);
        const uptime = getUptime();
        if (statusChanged) status = isUp ? 1 : 0;

        if (isUp) {
            res.json()
                .then(json => lastHealth = json)
                .catch(err => {
                    console.log('Failed to parse JSON response:');
                    console.log(err);
                });
        }

        if (statusChanged) {
            if (lastStatusChange) {
                console.log(`Wplace just went ${isUp ? 'up' : 'down'}! It was ${isUp ? 'down' : 'up'} ${stateChangedSinceStart ? `for ${Math.round(getLastStatusChange().hours)} hour(s)` : `since I started (${Math.round(getLastStatusChange().hours)} hour(s) ago)`}${!isUp && uptime ? `, and the backends uptime was ${Math.round(uptime.hours)} hour(s)` : ''}`);
                alertStatus();
                stateChangedSinceStart = true;
            }
            lastStatusChange = Date.now();
        } else {
            console.log(`Wplace has been ${isUp ? 'up' : 'down'} since ${stateChangedSinceStart ? new Date(lastStatusChange).toUTCString() : `I started (${Math.round(getLastStatusChange().hours)} hour(s) ago)`}`);
        }
    }).catch(err => {
        console.log('Failed to check status:');
        console.log(err);
    });
};

async function alertStatus() {
    const isUp = status === 1;
    const uptime = getUptime();

    const message = {
        embeds: [
            {
                title: `Wplace just went ${isUp ? 'up' : 'down'}!`,
                description: `It was ${isUp ? 'down' : 'up'} ${stateChangedSinceStart ? `for ${Math.round(getLastStatusChange().hours)} hour(s)` : `since I started (${Math.round(getLastStatusChange().hours)} hour(s) ago)`}`,
                color: isUp ? 4362485 : 16078658,
                fields: [
                    ...(stateChangedSinceStart ? [{
                        name: `${isUp ? 'Down' : 'Up'} since`,
                        value: new Date(lastStatusChange).toUTCString()
                    }] : []),
                    ...(!isUp && uptime ? [{
                        name: 'Backend uptime',
                        value: `${Math.round(uptime.hours)} hour(s)`
                    }] : [])
                ]
            }
        ]
    };

    for (const webhook of config.webhooks) {
        const id = webhook.match(/\/webhooks\/(\d+)\//)?.[1];
        const res = await fetch(webhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        }).catch(err => { });
        if (res?.status !== 204) console.log(`Failed to send message using webhook ${id}`);
    }

    for (const channel of config.channels) {
        const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bot ${config.botToken}`
            },
            body: JSON.stringify(message)
        }).catch(err => { });
    if (res?.status !== 200) console.log(`Failed to send message to channel ${channel}`);
    }
}

function getUptime() {
    if (!lastHealth?.uptime) return null;
    const uptime = parseFloat(lastHealth.uptime);
    // const uptime = parseFloat('9429.1949199404s');

    const ms = uptime * 1000;
    const seconds = uptime;
    const minutes = seconds / 60;
    const hours = minutes / 60;

    return {
        ms,
        seconds,
        minutes,
        hours
    };
}

function getLastStatusChange() {
    if (!lastStatusChange) return null;
    const date = Date.now();

    const ms = date - lastStatusChange;
    const seconds = ms / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;

    return {
        ms,
        seconds,
        minutes,
        hours,
        date: new Date(lastStatusChange)
    };
}