var openUrl = "https://cps.combain.com"
var fetch = require('cross-fetch')
var key = 'fl23n2xx7uz5uj6kvrzw'
const scanner = require('node-wifi-scanner');

execute('npm install wifiscanner')

const client = require('./lib/client')

var m = JSON.parse(`{"rtu":{"model":"anko-tpe","serial":"odn12345678","loc":"23,117"},"xyz":{"z01":{"name":"temp","unit":"℃","range":[20,90],"warning":[70,90]},"z02":{"name":"current","unit":"mA","range":[0,30],"warning":[20,30]}},"dreg":{"d01":{"name":"temp","unit":"℃","range":[20,90],"warning":[70,90]},"d02":{"name":"current","unit":"mA","range":[0,30],"warning":[20,30]}},"timestamp":{"repeat":"1","interval":"10"},"data":{},"notify":{"ddn":">>comm","topic":"tg://-352168287","payload":""},"log":{"ddn":">>#anko-view","topic":"","payload":""}}`);

function execute(command) {
    const exec = require('child_process').exec

    exec(command, (err, stdout, stderr) => {
        process.stdout.write(stdout)
    })
}

function getWifiInfo() {
    return new Promise((resolve, reject) => {
        scanner.scan((err, networks) => {
            if (err) {
                reject(err);
                return;
            }
            var re = `{"wifiAccessPoints": [`
            for (var i in networks) {
                if (i < 15)
                re = re + (`{"macAddress":"${networks[i].mac}", "signalStrength":${networks[i].rssi}},`)
            }
            resolve(re)
        });
    })
}

async function get_loc() {
    let re = await getWifiInfo()

    return await fetch(`${openUrl}?key=${key}`, {
        method: "POST",
        body: `${re.substr(0, re.length - 1) + `]}`}`,
        headers: {
            "Content-Type": "application/json"
        }
    }).then(res => res.text())
}

function rd(lower, upper) { return Math.floor(Math.random() * (upper - lower)) + lower }

function ru() {
    var s = []
    for (var x in m.xyz) {
        let val = rd(m.xyz[x].range["0"], m.xyz[x].range["1"])
        let warning_lower = m.xyz[x].warning["0"]
        let warning_upper = m.xyz[x].warning["1"]

        let warning = val > warning_lower && val < warning_upper ? "*warning*" : ""
        s.push(`[${x}] ${m.xyz[x].name}: \t${val} ${m.xyz[x].unit}\t${warning}`)
    }
    return s
}

async function setup() {
    var date = new Date()
    date = (date.getFullYear() + ('00' + (date.getMonth() + 1)).slice(-2) + ('00' + date.getDate()).slice(-2) +
        ('00' + date.getHours()).slice(-2) + ('00' + date.getMinutes()).slice(-2) + "-" +
        ('00' + date.getSeconds()).slice(-2) + ('0' + date.getMilliseconds()).slice(-1))
	let get_locs = await get_loc();
    var re_tg = `ID:${date}
model:  ${m.rtu.model}
serial:    ${m.rtu.serial}
loc:          ${JSON.parse(get_locs)}\n`

    ru().map((item) => re_tg += item + '\n');
    console.log(re_tg)
    let payload_tg = { "type": "message", "content": re_tg }

    client.send(m.notify.topic, m.notify.ddn, payload_tg)

    var date = new Date()
    let payload_view = `
"content": {
"0": "re_tg"
}
"time": "${('00' + date.getHours()).slice(-2)}:${('00' + date.getMinutes()).slice(-2)}:${('00' + date.getSeconds()).slice(-2)}"
"from": ${m.rtu.model}
"to": "anko-dhq"
"note": "9"
"status": 0`
    client.send(m.log.topic, m.log.ddn, payload_view)

    if (m.timestamp.repeat == "1") setTimeout(setup, (m.timestamp.interval * 1000))
}

client.init()
setup()
